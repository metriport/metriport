import { Config } from "../../util/config";
import { IdGenerator, createIdGenerator } from "./id-generator";
import { SftpClient, SftpConfig } from "../sftp/client";
import { SurescriptsSynchronizeEvent } from "./types";
import { getS3Key, getSftpDirectory, getSftpFileName } from "./shared";
import { INCOMING_NAME, OUTGOING_NAME, HISTORY_NAME } from "./constants";
import { S3Utils } from "../aws/s3";
import { toSurescriptsPatientLoadFile, canGeneratePatientLoadFile } from "./message";
import { Patient } from "@metriport/shared/domain/patient";
import dayjs from "dayjs";
import { MetriportError } from "@metriport/shared";

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

export type TransmissionData = Pick<Transmission, "cxId" | "npiNumber" | "compression">;

export interface Transmission {
  type: TransmissionType;
  npiNumber: string;
  cxId: string;
  id: string;
  timestamp: number; // UTC
  requestFileName: string;
  compression?: boolean;
}

export class SurescriptsSftpClient extends SftpClient {
  private generateTransmissionId: IdGenerator;
  private readonly s3: S3Utils;
  private readonly replicaBucket: string;

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

    // 10 byte ID generator
    this.generateTransmissionId = createIdGenerator(10);
    this.s3 = new S3Utils(config.replicaBucketRegion ?? Config.getAWSRegion());
    this.replicaBucket = config.replicaBucket ?? Config.getSurescriptsReplicaBucketName();

    this.senderId = config.senderId ?? Config.getSurescriptsSftpSenderId();
    this.senderPassword = config.senderPassword ?? Config.getSurescriptsSftpSenderPassword();
    this.usage = Config.isProduction()
      ? SurescriptsEnvironment.Production
      : SurescriptsEnvironment.Test;
    this.receiverId = config.receiverId ?? Config.getSurescriptsSftpReceiverId();
  }

  createTransmission({ npiNumber, cxId, compression }: TransmissionData): Transmission {
    const transmissionId = this.generateTransmissionId().toString("ascii");

    const now = Date.now();
    const requestFileName = this.getPatientLoadFileName(transmissionId, now, compression);

    return {
      type: TransmissionType.Enroll,
      npiNumber,
      cxId,
      id: transmissionId,
      timestamp: now,
      requestFileName,
      compression: compression ?? false,
    };
  }

  // GENERATE AND WRITE PATIENT LOAD FILES TO S3
  // First step of the Surescripts integration flow

  async generateAndWritePatientLoadFile(
    transmissionData: TransmissionData,
    patients: Patient[]
  ): Promise<{
    requestedPatientIds: string[];
    transmissionId: string;
    requestFileName: string;
    requestFileContent: Buffer;
  }> {
    const { content, transmission, requestedPatientIds } = this.generatePatientLoadFile(
      transmissionData,
      patients
    );
    await this.writePatientLoadFileToS3(transmission, content);
    return {
      requestedPatientIds,
      transmissionId: transmission.id,
      requestFileName: transmission.requestFileName,
      requestFileContent: content,
    };
  }

  generatePatientLoadFile(
    transmissionData: TransmissionData,
    patients: Patient[]
  ): { content: Buffer; transmission: Transmission; requestedPatientIds: string[] } {
    const transmission = this.createTransmission(transmissionData);

    if (!canGeneratePatientLoadFile(transmission, patients)) {
      throw new MetriportError("Cannot generate patient load file", "generate_patient_load_file", {
        npiNumber: transmission.npiNumber,
        cxId: transmission.cxId,
        patientCount: patients.length,
      });
    }

    return {
      ...toSurescriptsPatientLoadFile(this, transmission, patients),
      transmission,
    };
  }

  async writePatientLoadFileToS3(transmission: Transmission, fileContent: Buffer): Promise<void> {
    const fileName = this.getPatientLoadFileName(
      transmission.id,
      transmission.timestamp,
      transmission.compression
    );

    await this.s3.uploadFile({
      bucket: this.replicaBucket,
      key: getS3Key(OUTGOING_NAME, fileName),
      file: fileContent,
      metadata: {
        transmissionId: transmission.id,
        cxId: transmission.cxId,
        npiNumber: transmission.npiNumber,
        timestamp: transmission.timestamp.toString(),
        compression: transmission.compression ? "true" : "false",
      },
    });
  }

  // RECEIVE VERIFICATION RESPONSE FROM SFTP
  // Second step of the Surescripts integration flow

  async receiveVerificationResponse(requestFileName: string): Promise<
    | {
        verificationFileName: string;
        verificationFileContent: Buffer;
      }
    | undefined
  > {
    const existingResponseKey = await this.findVerificationResponseKeyInS3(requestFileName);
    if (existingResponseKey) {
      const verificationFileContent = await this.s3.downloadFile({
        bucket: this.replicaBucket,
        key: existingResponseKey,
      });
      const verificationFileName = existingResponseKey.substring(
        existingResponseKey.lastIndexOf("/") + 1
      );
      return {
        verificationFileName,
        verificationFileContent,
      };
    }

    const fileName = await this.findVerificationFileNameInSftpServer(requestFileName);
    if (fileName) {
      const shouldDecompress = requestFileName.endsWith(".gz");
      const content = await this.read(getSftpFileName(INCOMING_NAME, fileName), {
        decompress: shouldDecompress,
      });
      await this.s3.uploadFile({
        bucket: this.replicaBucket,
        key: getS3Key(INCOMING_NAME, fileName),
        file: content,
        metadata: {
          requestFileName,
        },
      });
      return {
        verificationFileName: fileName,
        verificationFileContent: content,
      };
    }
    return undefined;
  }

  private async findVerificationResponseKeyInS3(
    requestFileName: string
  ): Promise<string | undefined> {
    const requestFileNameWithoutExtension = requestFileName.replace(/\.gz$/, "");
    const requestFileS3Prefix = getS3Key(INCOMING_NAME, requestFileNameWithoutExtension);
    const s3Files = await this.s3.listObjects(this.replicaBucket, requestFileS3Prefix);
    const firstS3File = s3Files[0];
    if (firstS3File && firstS3File.Key) {
      return firstS3File.Key;
    }
    return undefined;
  }

  private async findVerificationFileNameInSftpServer(
    requestFileName: string
  ): Promise<string | undefined> {
    const requestFileNameWithoutExtension = requestFileName.replace(/\.gz$/, "");

    const results = await this.list(getSftpDirectory(INCOMING_NAME), info => {
      const parsedFileName = this.parseVerificationFileName(info.name);
      return (
        parsedFileName != null &&
        parsedFileName.requestFileNameWithoutExtension === requestFileNameWithoutExtension
      );
    });
    return results[0];
  }

  // RECEIVE FLAT FILE RESPONSE FROM SFTP
  // Third step of the Surescripts integration flow

  async receiveFlatFileResponse(requestFileName: string): Promise<
    | {
        flatFileResponseName: string;
        flatFileResponseContent: Buffer;
      }
    | undefined
  > {
    const requestFileS3Key = getS3Key(INCOMING_NAME, requestFileName);
    const fileInfo = await this.s3.getFileInfoFromS3(requestFileS3Key, this.replicaBucket);
    if (!fileInfo.exists || !fileInfo.metadata) {
      throw new MetriportError("Original request file does not exist in S3: " + requestFileS3Key);
    }

    const { cxId, timestamp } = fileInfo.metadata;
    if (!cxId || !timestamp) {
      throw new MetriportError("Original request file does not have metadata: " + requestFileS3Key);
    }

    const flatFileResponseName = await this.findFlatFileResponseNameInSftpServer(
      cxId,
      parseInt(timestamp)
    );
    if (flatFileResponseName) {
      const content = await this.read(getSftpFileName(INCOMING_NAME, flatFileResponseName), {
        decompress: true,
      });
      await this.s3.uploadFile({
        bucket: this.replicaBucket,
        key: getS3Key(INCOMING_NAME, flatFileResponseName),
        file: content,
      });
      return {
        flatFileResponseName,
        flatFileResponseContent: content,
      };
    }
    return undefined;
  }

  private async findFlatFileResponseNameInSftpServer(
    cxId: string,
    timestamp: number
  ): Promise<string | undefined> {
    const responseFileNameSuffix = this.getFlatFileResponseSuffix(timestamp);
    const results = await this.list(getSftpDirectory(INCOMING_NAME), info => {
      return info.name.startsWith(cxId) && info.name.endsWith(responseFileNameSuffix);
    });
    return results[0];
  }

  async synchronize(event: SurescriptsSynchronizeEvent) {
    if (event.fromSurescripts) {
      event.debug?.("Copying from Surescripts...");
      await this.copyFromSurescripts(event);
      event.debug?.("Finished copying from Surescripts");
    } else if (event.toSurescripts) {
      event.debug?.("Copying to Surescripts...");
      await this.copyToSurescripts(event);
      event.debug?.("Finished copying to Surescripts");
    }
  }

  async copyFromSurescripts(event: SurescriptsSynchronizeEvent): Promise<SurescriptsOperation[]> {
    const operations: SurescriptsOperation[] = [];
    const sftpFiles = await this.list("/" + INCOMING_NAME);
    const s3Files = await this.s3.listObjects(this.replicaBucket, INCOMING_NAME + "/");
    const s3FileSet = new Set(s3Files.map(file => file.Key));
    event.debug?.("Found " + s3Files.length + " files in S3");

    for (const fileName of sftpFiles) {
      const key = getS3Key(INCOMING_NAME, fileName);

      if (!s3FileSet.has(key)) {
        const operation = await this.copyFileFromSurescripts(fileName, event);
        if (operation) operations.push(operation);
      }
    }
    return operations;
  }

  async copyFileFromSurescripts(
    fileName: string, // the base file name, without any directory prefixes
    { dryRun, debug }: SurescriptsSynchronizeEvent = {}
  ): Promise<SurescriptsOperation | undefined> {
    const sftpFileName = getSftpFileName(INCOMING_NAME, fileName);
    const exists = await this.exists(sftpFileName);
    if (!exists) {
      debug?.("File does not exist in SFTP: " + sftpFileName);
      return undefined;
    } else debug?.("File exists in SFTP: " + sftpFileName);

    const content = await this.read(sftpFileName);
    const s3Key = getS3Key(INCOMING_NAME, fileName);
    if (!dryRun) {
      debug?.("Copying to S3: " + s3Key);
      await this.s3.uploadFile({
        bucket: this.replicaBucket,
        key: s3Key,
        file: content,
      });
    }
    return {
      fromSurescripts: true,
      sftpFileName,
      s3Key,
      content,
    };
  }

  async copyToSurescripts(event: SurescriptsSynchronizeEvent): Promise<SurescriptsOperation[]> {
    const operations: SurescriptsOperation[] = [];
    const sftpHistory = await this.list("/" + HISTORY_NAME);
    const sftpHistorySet = new Set(sftpHistory);
    const s3Files = await this.s3.listObjects(this.replicaBucket, OUTGOING_NAME + "/");
    event.debug?.("Found SFTP history with length " + sftpHistory.length);

    for (const s3File of s3Files) {
      if (!s3File.Key) continue;

      const outgoingFileName = s3File.Key.substring(OUTGOING_NAME.length + 1);
      const sftpHistoryName = `${outgoingFileName}.${this.senderId}`;
      if (!sftpHistorySet.has(sftpHistoryName)) {
        const operation = await this.copyFileToSurescripts(outgoingFileName, event);
        if (operation) operations.push(operation);
      }
    }
    return operations;
  }

  async copyFileToSurescripts(
    fileName: string, // the base file name, without any directory prefixes
    { dryRun, debug }: SurescriptsSynchronizeEvent = {}
  ): Promise<SurescriptsOperation | undefined> {
    debug?.(`${dryRun ? "DRY RUN: " : ""}Copying to Surescripts: ${fileName}`);

    const s3Key = getS3Key(OUTGOING_NAME, fileName);
    const s3FileExists = await this.s3.fileExists(this.replicaBucket, s3Key);

    if (!s3FileExists) {
      debug?.("File does not exist in S3: " + s3Key);
      return undefined;
    }

    const content = await this.s3.downloadFile({
      bucket: this.replicaBucket,
      key: s3Key,
    });

    const sftpFileName = getSftpFileName(OUTGOING_NAME, fileName);
    if (!dryRun) {
      await this.write(sftpFileName, content);
      debug?.("Copied to Surescripts: " + sftpFileName);
    }
    return {
      toSurescripts: true,
      sftpFileName,
      s3Key,
      content,
    };
  }

  async isPatientLoadFileInSurescriptsHistory(requestFileName: string): Promise<boolean> {
    const historyFileName = `${requestFileName}.${this.senderId}`;
    return await this.exists(getSftpFileName(HISTORY_NAME, historyFileName));
  }

  private getPatientLoadFileName(
    id: string, // the unique 10-byte transmission ID
    timestamp: number,
    compression = false
  ): string {
    return [
      "Metriport_PMA_",
      dayjs(timestamp).format("YYYYMMDD"),
      "-",
      id,
      compression ? ".gz" : "",
    ].join("");
  }

  private getFlatFileResponseSuffix(timestamp: number): string {
    return ["_", dayjs(timestamp).format("YYYYMMDDHHmmss"), ".gz"].join("");
  }

  private parseVerificationFileName(remoteFileName: string): {
    requestFileNameWithoutExtension: string;
    acceptedBySurescripts: Date;
    processedBySurescripts: Date;
    compression: boolean;
  } | null {
    const [requestFileNameWithoutExtension, sstimestamp1, sstimestamp2, maybeGzExtract] =
      remoteFileName.split(".");
    if (
      !requestFileNameWithoutExtension ||
      !sstimestamp1?.match(/^\d+$/) ||
      !sstimestamp2?.match(/^\d+$/)
    ) {
      return null;
    }
    const compression = maybeGzExtract === "gz-extract";
    if (!compression && maybeGzExtract !== "rsp") {
      return null;
    }

    const acceptedBySurescripts = dayjs(sstimestamp1).toDate();
    const processedBySurescripts = dayjs(sstimestamp2).toDate();
    return {
      requestFileNameWithoutExtension,
      compression,
      acceptedBySurescripts,
      processedBySurescripts,
    };
  }
}
