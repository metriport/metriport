import { Config } from "../../util/config";
import { IdGenerator, createIdGenerator } from "./id-generator";
import { SftpClient } from "../sftp/client";
import { SftpConfig } from "../sftp/types";
import { SurescriptsPatientRequestData, SurescriptsRequesterData } from "./types";
import { generateSurescriptsRequestFile } from "./file-generator";
import { validateNPI } from "@metriport/shared/common/validate-npi";

import { MetriportError } from "@metriport/shared";
import {
  makeRequestFileName,
  makeResponseFileSuffix,
  parseVerificationFileName,
} from "./file-names";
import { SftpFile } from "../sftp/types";

export interface SurescriptsSftpConfig extends Partial<Omit<SftpConfig, "password">> {
  senderId?: string;
  senderPassword?: string;
  receiverId?: string;
  publicKey?: string;
  privateKey?: string;
  replicaBucket?: string;
  replicaBucketRegion?: string;
}

export interface SurescriptsOperation {
  fromSurescripts?: boolean;
  toSurescripts?: boolean;
  sftpFileName: string;
  s3Key: string;
  content?: Buffer;
}

export enum SurescriptsEnvironment {
  Production = "P",
  Test = "T",
}

export enum TransmissionType {
  Enroll = "ENR",
  Unenroll = "UNR",
}

export type TransmissionData = Pick<Transmission, "cxId" | "npiNumber">;

export interface Transmission {
  type: TransmissionType;
  npiNumber: string;
  cxId: string;
  id: string;
  requestFileName: string;
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

    this.useS3Replica({
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

  async readIncomingFileFromSftp(responseFileName: string): Promise<Buffer | undefined> {
    try {
      await this.connect();
      const remotePath = `/from_surescripts/${responseFileName}`;
      const exists = await this.exists(remotePath);
      if (!exists) return undefined;
      return await this.read(remotePath, { decompress: responseFileName.endsWith(".gz") });
    } finally {
      await this.disconnect();
    }
  }

  validateRequester(requester: SurescriptsRequesterData): void {
    if (!validateNPI(requester.facility.npi)) {
      throw new MetriportError("Invalid NPI", undefined, {
        npiNumber: requester.facility.npi,
        cxId: requester.cxId,
      });
    }
  }

  /**
   * @param requestData the single patient request data for Surescripts data
   * @returns a unique transmission ID if the request was sent, undefined otherwise
   */
  async sendRequest(requestData: SurescriptsPatientRequestData): Promise<string | undefined> {
    this.validateRequester(requestData);
    const transmissionId = this.generateTransmissionId().toString("ascii");
    const content = generateSurescriptsRequestFile(this, transmissionId, requestData);
    // If missing some demographic information that is required by Surescripts
    if (!content) {
      return undefined;
    }

    const requestFileName = makeRequestFileName(transmissionId);
    try {
      await this.connect();
      await this.writeThroughReplica(`/to_surescripts/${requestFileName}`, content);
      return transmissionId;
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
      const historyFiles = await this.listWithContainsQuery("/history", requestFileName);
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

    const verificationCandidates = await this.listWithPrefixThroughReplica(
      "from_surescripts",
      requestFileName
    );
    const verificationFileName = verificationCandidates.find(candidate => {
      const parsedFileName = parseVerificationFileName(candidate);
      return parsedFileName?.requestFileName === requestFileName;
    });

    if (verificationFileName) {
      const content = await this.readThroughReplica(verificationFileName, {
        decompress: verificationFileName.endsWith(".gz.rsp"),
      });
      return {
        fileName: verificationFileName,
        content,
      };
    }

    return undefined;
  }

  /**
   * @param transmissionId the original request transmission ID
   * @returns the most recent flat file response for the specified transmission
   */
  async receiveResponse(transmissionId: string): Promise<SftpFile | undefined> {
    const responseFileCandidates = await this.listWithPrefixThroughReplica(
      "from_surescripts",
      transmissionId
    );
    const responseFileSuffix = makeResponseFileSuffix(transmissionId);
    const responseFile = responseFileCandidates.find(candidate => {
      return candidate.endsWith(responseFileSuffix);
    });

    if (responseFile) {
      const content = await this.readThroughReplica(responseFile, {
        decompress: responseFile.endsWith(".gz"),
      });
      return {
        fileName: responseFile,
        content,
      };
    }

    return undefined;
  }
}
