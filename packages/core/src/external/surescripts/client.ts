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
  private readonly bucket: string;

  senderId: string;
  senderPassword: string;
  receiverId: string;
  usage: SurescriptsEnvironment;

  constructor(config: SurescriptsSftpConfig) {
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
    this.bucket = config.replicaBucket ?? Config.getSurescriptsReplicaBucketName();

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

  generatePatientLoadFile(
    transmission: Transmission,
    patients: Patient[]
  ): { content: Buffer; requestedPatientIds: string[] } {
    if (!canGeneratePatientLoadFile(transmission, patients)) {
      throw new MetriportError("Cannot generate patient load file", "generate_patient_load_file", {
        npiNumber: transmission.npiNumber,
        cxId: transmission.cxId,
        patientCount: patients.length,
      });
    }

    return toSurescriptsPatientLoadFile(this, transmission, patients);
  }

  async writePatientLoadFileToStorage(transmission: Transmission, message: Buffer) {
    const fileName = this.getPatientLoadFileName(
      transmission.id,
      transmission.timestamp,
      transmission.compression
    );
    await this.s3.uploadFile({
      bucket: this.bucket,
      key: getS3Key(OUTGOING_NAME, fileName),
      file: message,
    });
  }

  async receiveVerificationResponse(transmission: Transmission) {
    const fileName = await this.findVerificationFileName(transmission.requestFileName);
    if (fileName) {
      const content = await this.read(getSftpFileName(INCOMING_NAME, fileName));
      await this.s3.uploadFile({
        bucket: this.bucket,
        key: getS3Key(INCOMING_NAME, fileName),
        file: content,
      });
    }
  }

  async receiveFlatFileResponse(transmission: Transmission) {
    const fileName = await this.findFlatFileResponseName(transmission.cxId, transmission.timestamp);
    if (fileName) {
      const content = await this.read(getSftpFileName(INCOMING_NAME, fileName));
      await this.s3.uploadFile({
        bucket: this.bucket,
        key: getS3Key(INCOMING_NAME, fileName),
        file: content,
      });
    }
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
    } else if (event.checkFileStatus) {
      event.debug?.("Checking file status with Surescripts: " + event.checkFileStatus.fileName);
      const status = await this.checkFileStatusWithSurescripts(event.checkFileStatus);
      event.debug?.(JSON.stringify(status, null, 2));
    }
  }

  async copyFromSurescripts(event: SurescriptsSynchronizeEvent) {
    const sftpFiles = await this.list("/" + INCOMING_NAME);
    const s3Files = await this.s3.listObjects(this.bucket, INCOMING_NAME + "/");
    const s3FileSet = new Set(s3Files.map(file => file.Key));
    event.debug?.("Found " + s3Files.length + " files in S3");

    for (const fileName of sftpFiles) {
      const key = getS3Key(INCOMING_NAME, fileName);

      if (!s3FileSet.has(key)) {
        await this.copyFileFromSurescripts(fileName, event);
      }
    }
  }

  async copyFileFromSurescripts(
    fileName: string, // the base file name, without any directory prefixes
    { dryRun, debug }: SurescriptsSynchronizeEvent = {}
  ): Promise<Buffer | null> {
    const sftpFileName = getSftpFileName(INCOMING_NAME, fileName);
    const exists = await this.exists(sftpFileName);
    if (!exists) {
      debug?.("File does not exist in SFTP: " + sftpFileName);
      return null;
    } else debug?.("File exists in SFTP: " + sftpFileName);

    const content = await this.read(sftpFileName);
    if (!dryRun) {
      const s3Key = getS3Key(INCOMING_NAME, fileName);
      debug?.("Copying to S3: " + s3Key);
      await this.s3.uploadFile({
        bucket: this.bucket,
        key: s3Key,
        file: content,
      });
    }
    return content;
  }

  async copyToSurescripts(event: SurescriptsSynchronizeEvent) {
    const sftpHistory = await this.list("/" + HISTORY_NAME);
    const sftpHistorySet = new Set(sftpHistory);

    event.debug?.("Found SFTP history with length " + sftpHistory.length);
    const s3Files = await this.s3.listObjects(this.bucket, OUTGOING_NAME + "/");

    for (const s3File of s3Files) {
      if (!s3File.Key) continue;

      const outgoingFileName = s3File.Key.substring(OUTGOING_NAME.length + 1);
      const sftpHistoryName = `${outgoingFileName}.${this.senderId}`;
      if (!sftpHistorySet.has(sftpHistoryName)) {
        event.debug?.(
          (event.dryRun ? "DRY RUN: " : "") + "Copying to Surescripts: " + outgoingFileName
        );
        await this.copyFileToSurescripts(outgoingFileName, event);
      }
    }
  }

  async copyFileToSurescripts(
    fileName: string, // the base file name, without any directory prefixes
    { dryRun, debug }: SurescriptsSynchronizeEvent = {}
  ): Promise<Buffer | null> {
    const s3Key = getS3Key(OUTGOING_NAME, fileName);
    const s3FileExists = await this.s3.fileExists(this.bucket, s3Key);
    if (!s3FileExists) {
      debug?.("File does not exist in S3: " + s3Key);
      return null;
    }

    const content = await this.s3.downloadFile({
      bucket: this.bucket,
      key: s3Key,
    });

    if (!dryRun) {
      const sftpFileName = getSftpFileName(OUTGOING_NAME, fileName);
      await this.write(sftpFileName, content);
      debug?.("Copied to Surescripts: " + sftpFileName);
    }
    return content;
  }

  async sendPatientLoadFileByName(fileName: string) {
    const s3Key = getS3Key(OUTGOING_NAME, fileName);
    const s3FileExists = await this.s3.fileExists(this.bucket, s3Key);
    if (!s3FileExists) {
      throw new MetriportError("File does not exist in S3: " + s3Key);
    }

    console.log("Downloading patient load file from S3: " + fileName);
    const content = await this.s3.downloadFile({
      bucket: this.bucket,
      key: s3Key,
    });

    console.log("Sending patient load file to Surescripts: " + fileName);
    await this.write(getSftpFileName(OUTGOING_NAME, fileName), content);
    console.log("Sent patient load file to Surescripts: " + fileName);
  }

  async checkFileStatusWithSurescripts({
    cxId,
    fileName,
    timestamp,
  }: {
    cxId: string;
    fileName: string;
    timestamp: number;
  }): Promise<{ didSend: boolean; didVerify: boolean; didReceive: boolean }> {
    const expectedFileNameInHistory = getSftpFileName(HISTORY_NAME, `${fileName}.${this.senderId}`);
    const didSend = await this.exists(expectedFileNameInHistory);
    const didVerify = didSend ? (await this.findVerificationFileName(fileName)) != null : false;
    const didReceive = didVerify
      ? (await this.findFlatFileResponseName(cxId, timestamp)) != null
      : false;

    return {
      didSend,
      didVerify,
      didReceive,
    };
  }

  async didCopyPatientLoadFileToSurescripts(transmission: Transmission) {
    const fileName = this.getExpectedPatientLoadFileNameInAuditLogs(
      transmission.id,
      transmission.timestamp,
      transmission.compression
    );
    const sftpFileName = getSftpFileName(HISTORY_NAME, fileName);
    const exists = await this.exists(sftpFileName);
    return exists;
  }

  async didReceiveVerificationResponseFromSurescripts(transmission: Transmission) {
    const fileName = await this.findVerificationFileName(transmission.requestFileName);
    return fileName != null;
  }

  async didReceiveFlatFileResponseFromSurescripts(transmission: Transmission) {
    const fileName = await this.findFlatFileResponseName(transmission.cxId, transmission.timestamp);
    return fileName != null;
  }

  private getPatientLoadFileName(
    id: string, // the UUID of the transmission
    timestamp: number,
    compression = true
  ): string {
    return [
      "Metriport_PMA_",
      dayjs(timestamp).format("YYYYMMDD"),
      "-",
      id,
      compression ? ".gz" : "",
    ].join("");
  }

  private getExpectedPatientLoadFileNameInAuditLogs(
    id: string,
    timestamp: number,
    compression = true
  ) {
    const fileName = this.getPatientLoadFileName(id, timestamp, compression);
    return `${fileName}.${this.senderId}`;
  }

  private async findVerificationFileName(fileName: string): Promise<string | undefined> {
    const fileNameWithoutExtension = fileName.replace(/\.gz$/, "");

    const results = await this.list(getSftpDirectory(INCOMING_NAME), info => {
      const parsedFileName = this.parseVerificationFileName(info.name);
      return (
        parsedFileName != null &&
        parsedFileName.requestFileNameWithoutExtension === fileNameWithoutExtension
      );
    });
    return results[0];
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

  private async findFlatFileResponseName(
    cxId: string,
    timestamp: number
  ): Promise<string | undefined> {
    const transmissionDateTimeSuffix = ["_", dayjs(timestamp).format("YYYYMMDDHHmmss"), ".gz"].join(
      ""
    );
    const results = await this.list(getSftpDirectory(INCOMING_NAME), info => {
      return info.name.startsWith(cxId) && info.name.endsWith(transmissionDateTimeSuffix);
    });
    return results[0];
  }
}
