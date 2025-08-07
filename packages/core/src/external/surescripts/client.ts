import { BadRequestError, MetriportError } from "@metriport/shared";
import { validateNPI } from "@metriport/shared/common/validate-npi";
import { Config } from "../../util/config";
import { SftpClient } from "../sftp/client";
import { SftpFile } from "../sftp/types";
import { SurescriptsReplica } from "./replica";
import { isSurescriptsFeatureFlagEnabledForCx } from "../../command/feature-flags/domain-ffs";
import { generateBatchRequestFile, generatePatientRequestFile } from "./file/file-generator";
import { IdGenerator, createIdGenerator } from "./id-generator";
import {
  SurescriptsBatchRequestData,
  SurescriptsEnvironment,
  SurescriptsFileIdentifier,
  SurescriptsPatientRequestData,
  SurescriptsRequesterData,
  SurescriptsSftpConfig,
} from "./types";

import {
  buildRequestFileName,
  buildResponseFileNamePrefix,
  parseResponseFileName,
  parseVerificationFileName,
} from "./file/file-names";

export class SurescriptsSftpClient extends SftpClient {
  private generateTransmissionId: IdGenerator;

  senderId: string;
  senderPassword: string;
  receiverId: string;
  usage: SurescriptsEnvironment;

  constructor(config: SurescriptsSftpConfig = {}) {
    super({
      ...config,
      host: config.host ?? Config.getSurescriptsHost(),
      port: 22,
      username: config.username ?? Config.getSurescriptsSftpSenderId(),
      password: config.publicKey ?? Config.getSurescriptsSftpPublicKey(),
      privateKey: config.privateKey ?? Config.getSurescriptsSftpPrivateKey(),
    });
    this.setReplica(new SurescriptsReplica(config));

    // 10 byte ID generator
    this.generateTransmissionId = createIdGenerator(10);
    this.senderId = config.senderId ?? Config.getSurescriptsSftpSenderId();
    this.receiverId = config.receiverId ?? Config.getSurescriptsSftpReceiverId();
    this.senderPassword = config.senderPassword ?? Config.getSurescriptsSftpSenderPassword();
    this.usage = Config.isProduction()
      ? SurescriptsEnvironment.Production
      : SurescriptsEnvironment.Test;
  }

  /**
   * @param requestData the single patient request data for Surescripts data
   * @returns a unique transmission ID if the request was sent, undefined otherwise
   */
  async sendPatientRequest(
    requestData: SurescriptsPatientRequestData
  ): Promise<string | undefined> {
    await this.validateRequester(requestData);
    const transmissionId = this.generateTransmissionId().toString("ascii");
    const content = generatePatientRequestFile({
      client: this,
      transmissionId,
      ...requestData,
    });
    if (!content) {
      this.log(
        `No content generated for patient ID: ${requestData.patient.id}, cxId: ${requestData.cxId}`
      );
      return undefined;
    }

    const requestFileName = buildRequestFileName(transmissionId);
    try {
      await this.connect();
      await this.writeToSurescripts(requestFileName, content);
      return transmissionId;
    } finally {
      await this.disconnect();
    }
  }

  /**
   * @param requestData the batch request for multiple patients
   * @returns a unique transmission ID and the requested patient IDs if the request was sent, undefined otherwise
   */
  async sendBatchRequest(
    requestData: SurescriptsBatchRequestData
  ): Promise<{ transmissionId: string; requestedPatientIds: string[] } | undefined> {
    await this.validateRequester(requestData);
    const transmissionId = this.generateTransmissionId().toString("ascii");
    const { content, requestedPatientIds } = generateBatchRequestFile({
      client: this,
      transmissionId,
      ...requestData,
    });
    if (!content) {
      this.log(
        `No content generated for batch request: ${requestData.facility.id}, cxId: ${requestData.cxId}`
      );
      return undefined;
    }

    const requestFileName = buildRequestFileName(transmissionId);
    try {
      await this.connect();
      await this.writeToSurescripts(requestFileName, content);
      return { transmissionId, requestedPatientIds };
    } finally {
      await this.disconnect();
    }
  }

  /**
   * Send multiple patient requests in a single connection event. Since the latency of a Surescripts
   * load is dominated by connect/disconnect latency, this allows large rosters to be loaded 10x faster.
   */
  async sendBatchPatientRequest(
    requests: SurescriptsPatientRequestData[]
  ): Promise<SurescriptsFileIdentifier[]> {
    const identifiers: SurescriptsFileIdentifier[] = [];
    try {
      await this.connect();

      let totalRequests = 0;
      for (const request of requests) {
        await this.validateRequester(request);
        const transmissionId = this.generateTransmissionId().toString("ascii");
        const content = generatePatientRequestFile({
          client: this,
          transmissionId,
          ...request,
        });
        if (!content) continue;
        this.log(
          `${totalRequests.toString().padStart(6, " ")} - sending request for ${
            request.patient.id
          } (${transmissionId})`
        );
        totalRequests++;

        const requestFileName = buildRequestFileName(transmissionId);
        await this.writeToSurescripts(requestFileName, content);
        identifiers.push({ transmissionId, populationId: request.patient.id });
      }

      return identifiers;
    } finally {
      await this.disconnect();
    }
  }

  /**
   * Requests can take up to an hour to show up in Surescripts history.
   * @param transmissionId the transmission ID to verify
   * @returns true if the request is present in the Surescripts history, false otherwise
   */
  async verifyRequestInHistory(transmissionId: string): Promise<boolean> {
    const requestFileName = buildRequestFileName(transmissionId);
    try {
      await this.connect();
      const historyFiles = await this.list("/history", file => file.name.includes(requestFileName));
      this.log(`Found ${historyFiles.length} matching history files for ${transmissionId}`);
      return historyFiles.length > 0;
    } finally {
      await this.disconnect();
    }
  }

  /**
   * @param transmissionId the original request transmission ID
   * @returns the most recent verification response file for the specified transmission
   */
  async receiveVerificationResponse(transmissionId: string): Promise<SftpFile | undefined> {
    const requestFileName = buildRequestFileName(transmissionId);

    const replicatedVerificationFile = await this.findVerificationFileInReplica(requestFileName);
    if (replicatedVerificationFile) {
      this.log(`Already copied verification file "${replicatedVerificationFile}" to replica`);
      return this.readFromReplica(replicatedVerificationFile);
    }

    try {
      await this.connect();
      const verificationFile = await this.findVerificationFile(requestFileName);
      if (verificationFile) {
        this.log(`Found verification file "${verificationFile}" in Surescripts directory`);
        return await this.readFromSurescripts(verificationFile);
      }
      this.log(`No verification file found for ${transmissionId}`);
      return undefined;
    } finally {
      await this.disconnect();
    }
  }

  /**
   * @param requestFileName the original request file name
   * @returns the verification file name if it exists in the Surescripts directory, undefined otherwise
   */
  private async findVerificationFile(requestFileName: string): Promise<string | undefined> {
    const verificationFileNameMatches = await this.list("/from_surescripts", file => {
      const parsedFileName = parseVerificationFileName(file.name);
      return parsedFileName?.requestFileName === requestFileName;
    });
    return verificationFileNameMatches[0];
  }

  /**
   * @param requestFileName the original request file name
   * @returns the verification file name if it exists in the replica, undefined otherwise
   */
  private async findVerificationFileInReplica(
    requestFileName: string
  ): Promise<string | undefined> {
    if (!this.replica) {
      throw new BadRequestError("No replica set", undefined, {
        context: "surescripts.client.findVerificationFileInReplica",
      });
    }
    const replicatedFilesWithPrefix = await this.replica.listFileNamesWithPrefix(
      "/from_surescripts",
      requestFileName
    );
    return replicatedFilesWithPrefix.find(fileName => {
      const parsedFileName = parseVerificationFileName(fileName);
      return parsedFileName?.requestFileName === requestFileName;
    });
  }

  /**
   * @param transmissionId the original request transmission ID
   * @param populationId the original request population ID
   * @returns the flat file response for the specified transmission
   */
  async receiveResponse({
    transmissionId,
    populationId,
  }: SurescriptsFileIdentifier): Promise<SftpFile | undefined> {
    const replicatedResponseFile = await this.findResponseFileInReplica({
      transmissionId,
      populationId,
    });
    if (replicatedResponseFile) {
      this.log(`Already copied response file "${replicatedResponseFile}" to replica`);
      return this.readFromReplica(replicatedResponseFile);
    }

    try {
      await this.connect();
      const sftpResponseFileName = await this.findResponseFile({
        transmissionId,
        populationId,
      });
      if (sftpResponseFileName) {
        this.log(`Found response file "${sftpResponseFileName}" in Surescripts directory`);
        return await this.readFromSurescripts(sftpResponseFileName);
      }
      this.log(`No response file found for ${transmissionId} and ${populationId}`);
      return undefined;
    } finally {
      await this.disconnect();
    }
  }

  /**
   * @param transmissionId the original request transmission ID
   * @param populationId the original request population UUID (patient ID or facility ID)
   * @returns the response file name if it exists in the Surescripts directory, undefined otherwise
   */
  private async findResponseFile({
    transmissionId,
    populationId,
  }: SurescriptsFileIdentifier): Promise<string | undefined> {
    const responseFileNameMatches = await this.list("/from_surescripts", file => {
      const parsedFileName = parseResponseFileName(file.name);
      return (
        parsedFileName?.transmissionId === transmissionId &&
        parsedFileName?.populationId === populationId
      );
    });
    return responseFileNameMatches[0];
  }

  /**
   * @param transmissionId the original request transmission ID
   * @param populationId the original request population ID
   * @returns the response file name if it exists in the replica, undefined otherwise
   */
  private async findResponseFileInReplica({
    transmissionId,
    populationId,
  }: SurescriptsFileIdentifier): Promise<string | undefined> {
    if (!this.replica) {
      throw new BadRequestError("No replica set", undefined, {
        context: "surescripts.client.findResponseFileInReplica",
      });
    }
    const responseFileNamePrefix = buildResponseFileNamePrefix(transmissionId, populationId);
    const replicatedFilesWithPrefix = await this.replica.listFileNamesWithPrefix(
      "from_surescripts",
      responseFileNamePrefix
    );
    const replicatedResponses = replicatedFilesWithPrefix.filter(fileName => {
      const parsedFileName = parseResponseFileName(fileName);
      return (
        parsedFileName &&
        parsedFileName.transmissionId === transmissionId &&
        parsedFileName.populationId === populationId
      );
    });
    const latestReplicatedResponse = replicatedResponses[replicatedResponses.length - 1];
    return latestReplicatedResponse;
  }

  /**
   * @param requester the requester data for Surescripts data
   * @throws an error if the requester's NPI is invalid
   */
  private async validateRequester(requester: SurescriptsRequesterData): Promise<void> {
    if (!validateNPI(requester.facility.npi)) {
      this.log(`Invalid NPI "${requester.facility.npi}" for CX ID "${requester.cxId}"`);
      throw new MetriportError("Invalid NPI", undefined, {
        npiNumber: requester.facility.npi,
        cxId: requester.cxId,
      });
    }
    const isSurescriptsEnabled = await isSurescriptsFeatureFlagEnabledForCx(requester.cxId);
    if (!isSurescriptsEnabled) {
      this.log(`Surescripts is not enabled for cx "${requester.cxId}"`);
      throw new MetriportError("Surescripts is not enabled", undefined, {
        cxId: requester.cxId,
      });
    }
    if (!this.isSurescriptsAllowedForOrgType(requester.org.type)) {
      this.log(
        `Cannot make Surescripts requests for cx "${requester.cxId}" with org type "${requester.org.type}"`
      );
      throw new MetriportError("Invalid Surescripts organization type", undefined, {
        cxId: requester.cxId,
        orgType: requester.org.type,
      });
    }
  }

  private isSurescriptsAllowedForOrgType(orgType: string): boolean {
    if (orgType === "healthcare_it_vendor") {
      return false;
    }
    if (orgType === "healthcare_provider") {
      return true;
    }
    // TODO: Determine the exact organization types that are allowed to make Surescripts requests
    return false;
  }

  /**
   * @param fileName the file name within the /to_surescripts directory to write
   * @param content the Buffer content to write
   */
  private async writeToSurescripts(fileName: string, content: Buffer): Promise<void> {
    const remotePath = `/to_surescripts/${fileName}`;
    await this.write(remotePath, content);
  }

  /**
   * @param fileName the file name within the /from_surescripts directory to read
   * @returns the SftpFile if it exists in the replica, undefined otherwise
   */
  private async readFromSurescripts(fileName: string): Promise<SftpFile | undefined> {
    const remotePath = `/from_surescripts/${fileName}`;
    const content = await this.read(remotePath, {
      decompress: fileName.endsWith(".gz") || fileName.endsWith(".gz.rsp"),
    });
    return { fileName, content };
  }

  /**
   * @param fileName the file name within the /from_surescripts directory to read
   * @returns the replica file if it exists in the replica, undefined otherwise
   */
  private async readFromReplica(fileName: string): Promise<SftpFile | undefined> {
    if (!this.replica) {
      throw new BadRequestError("No replica set", undefined, {
        context: "surescripts.client.readFromReplica",
      });
    }
    const replicaPath = `from_surescripts/${fileName}`;
    const content = await this.replica.readFile(replicaPath);
    return { fileName, content };
  }
}
