import { Config } from "../../util/config";
import { IdGenerator, createIdGenerator } from "./id-generator";
import { validateNPI } from "@metriport/shared/common/validate-npi";
import { SftpClient } from "../sftp/client";
import { SftpConfig, SftpFile } from "../sftp/types";
import {
  SurescriptsPatientRequestData,
  SurescriptsBatchRequestData,
  SurescriptsRequesterData,
} from "./types";
import { generatePatientRequestFile, generateBatchRequestFile } from "./file-generator";
import { MetriportError } from "@metriport/shared";
import {
  makeRequestFileName,
  makeResponseFileNamePrefix,
  parseResponseFileName,
  parseVerificationFileName,
} from "./file-names";

export interface SurescriptsSftpConfig extends Partial<Omit<SftpConfig, "password">> {
  senderId?: string;
  senderPassword?: string;
  receiverId?: string;
  publicKey?: string;
  privateKey?: string;
  replicaBucket?: string;
  replicaBucketRegion?: string;
}

export enum SurescriptsEnvironment {
  Production = "P",
  Test = "T",
}

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

    this.setS3Replica({
      bucketName: config.replicaBucket ?? Config.getSurescriptsReplicaBucketName(),
      region: config.replicaBucketRegion ?? Config.getAWSRegion(),
    });

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
    this.validateRequester(requestData);
    const transmissionId = this.generateTransmissionId().toString("ascii");
    const content = generatePatientRequestFile({
      client: this,
      transmissionId,
      ...requestData,
    });
    // If missing some demographic information that is required by Surescripts
    if (!content) return undefined;

    const requestFileName = makeRequestFileName(transmissionId);
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
   * @returns a transmission ID and the requested patient IDs if the request was sent, undefined otherwise
   */
  async sendBatchRequest(
    requestData: SurescriptsBatchRequestData
  ): Promise<{ transmissionId: string; requestedPatientIds: string[] } | undefined> {
    this.validateRequester(requestData);
    const transmissionId = this.generateTransmissionId().toString("ascii");
    const { content, requestedPatientIds } = generateBatchRequestFile({
      client: this,
      transmissionId,
      ...requestData,
    });
    if (!content) return undefined;

    const requestFileName = makeRequestFileName(transmissionId);
    try {
      await this.connect();
      await this.writeToSurescripts(requestFileName, content);
      return { transmissionId, requestedPatientIds };
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
    const requestFileName = makeRequestFileName(transmissionId);
    try {
      await this.connect();
      const historyFiles = await this.list("/history", file => file.name.includes(requestFileName));
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
    const requestFileName = makeRequestFileName(transmissionId);

    const replicatedVerificationFileName = await this.findVerificationFileNameInReplica(
      requestFileName
    );
    if (replicatedVerificationFileName) {
      return this.readFromSurescriptsReplica(replicatedVerificationFileName);
    }

    try {
      await this.connect();
      const verificationFileName = await this.findVerificationFileNameInSftpDirectory(
        requestFileName
      );
      if (verificationFileName) {
        return this.readFromSurescriptsSftpDirectory(verificationFileName);
      }
      return undefined;
    } finally {
      await this.disconnect();
    }
  }

  /**
   * @param requestFileName the original request file name
   * @returns the verification file name if it exists in the replica, undefined otherwise
   */
  private async findVerificationFileNameInReplica(
    requestFileName: string
  ): Promise<string | undefined> {
    if (!this.replica) return undefined;
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
   * @param requestFileName the original request file name
   * @returns the verification file name if it exists in the Surescripts directory, undefined otherwise
   */
  private async findVerificationFileNameInSftpDirectory(
    requestFileName: string
  ): Promise<string | undefined> {
    const verificationFileNameMatches = await this.list("/from_surescripts", file => {
      const parsedFileName = parseVerificationFileName(file.name);
      return parsedFileName?.requestFileName === requestFileName;
    });
    return verificationFileNameMatches[0];
  }

  /**
   * @param transmissionId the original request transmission ID
   * @returns the most recent flat file response for the specified transmission
   */
  async receivePatientResponse({
    transmissionId,
    patientId,
  }: {
    transmissionId: string;
    patientId: string;
  }): Promise<SftpFile | undefined> {
    const replicatedResponseFile = await this.findResponseFileNameInReplica(
      transmissionId,
      patientId
    );

    if (replicatedResponseFile) {
      return this.readFromSurescriptsReplica(replicatedResponseFile);
    }

    try {
      await this.connect();
      const sftpResponseFileName = await this.findResponseFileNameInSftpDirectory({
        transmissionId,
        populationId: patientId,
      });
      if (sftpResponseFileName) {
        return this.readFromSurescriptsSftpDirectory(sftpResponseFileName);
      }
      return undefined;
    } finally {
      await this.disconnect();
    }
  }

  /**
   * @param transmissionId the original request transmission ID
   * @param populationId the original request population ID
   * @returns the response file name if it exists in the replica, undefined otherwise
   */
  private async findResponseFileNameInReplica(
    transmissionId: string,
    populationId: string
  ): Promise<string | undefined> {
    if (!this.replica) return undefined;
    const responseFileNamePrefix = makeResponseFileNamePrefix(transmissionId, populationId);
    const replicatedFilesWithPrefix = await this.replica.listFileNamesWithPrefix(
      "from_surescripts",
      responseFileNamePrefix
    );
    return replicatedFilesWithPrefix.find(fileName => {
      const parsedFileName = parseResponseFileName(fileName);
      return (
        parsedFileName &&
        parsedFileName.transmissionId === transmissionId &&
        parsedFileName.populationId === populationId
      );
    });
  }

  /**
   * @param transmissionId the original request transmission ID
   * @param populationId the original request population UUID (patient ID or facility ID)
   * @returns the response file name if it exists in the Surescripts directory, undefined otherwise
   */
  private async findResponseFileNameInSftpDirectory({
    transmissionId,
    populationId,
  }: {
    transmissionId: string;
    populationId: string;
  }): Promise<string | undefined> {
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
   * @param requester the requester data for Surescripts data
   * @throws an error if the requester's NPI is invalid
   */
  private validateRequester(requester: SurescriptsRequesterData): void {
    if (!validateNPI(requester.facility.npi)) {
      throw new MetriportError("Invalid NPI", undefined, {
        npiNumber: requester.facility.npi,
        cxId: requester.cxId,
      });
    }
  }

  /**
   * @param fileName the file name within the /to_surescripts directory to write
   * @param content the Buffer content to write
   */
  private async writeToSurescripts(fileName: string, content: Buffer): Promise<void> {
    const remotePath = `/to_surescripts/${fileName}`;
    await this.write(remotePath, content);
    await this.writeToReplica(remotePath, content);
  }

  /**
   * @param fileName the file name within the /from_surescripts directory to read
   * @returns the SftpFile if it exists in the replica, undefined otherwise
   */
  private async readFromSurescriptsReplica(fileName: string): Promise<SftpFile | undefined> {
    const remotePath = `/from_surescripts/${fileName}`;
    return this.readFromReplica(remotePath);
  }

  /**
   * @param fileName the file name within the /from_surescripts directory to read
   * @returns the SftpFile if it exists in the replica, undefined otherwise
   */
  private async readFromSurescriptsSftpDirectory(fileName: string): Promise<SftpFile | undefined> {
    const remotePath = `/from_surescripts/${fileName}`;
    const content = await this.read(remotePath, {
      decompress: fileName.endsWith(".gz") || fileName.endsWith(".gz.rsp"),
    });
    await this.writeToReplica(remotePath, content);

    return {
      fileName,
      content,
    };
  }
}
