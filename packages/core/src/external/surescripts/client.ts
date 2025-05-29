import { Config } from "../../util/config";
import { IdGenerator, createIdGenerator } from "./id-generator";
import { SftpClient, SftpConfig } from "../sftp/client";
import { SurescriptsSynchronizeEvent } from "./types";
import { getS3Key, getSftpFileName } from "./shared";
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
}

export enum TransmissionType {
  Enroll = "ENR",
  Unenroll = "UNR",
}

export interface SurescriptsRequester {
  cxId: string;
  npiNumber: string;
}

export interface Transmission<T extends TransmissionType = TransmissionType> {
  type: T;
  npiNumber: string;
  cxId: string;
  id: string;
  idBytes: number[];
  timestamp: number; // UTC
  requestFileName: string;
  compression?: "gzip" | undefined;
}

export class SurescriptsSftpClient extends SftpClient {
  private transmissionIdGenerator: IdGenerator;
  private readonly s3: S3Utils;
  private readonly bucket: string;

  senderId: string;
  senderPassword: string;
  receiverId: string;
  usage: "T" | "P"; // test or production

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
    this.transmissionIdGenerator = createIdGenerator(10);
    this.s3 = new S3Utils(process.env.AWS_REGION ?? "us-east-2");
    this.bucket = config.replicaBucket ?? Config.getSurescriptsReplicaBucketName();

    this.senderId = config.senderId ?? Config.getSurescriptsSftpSenderId();
    this.senderPassword = config.senderPassword ?? Config.getSurescriptsSftpSenderPassword();
    this.usage = Config.isCloudEnv() ? "P" : "T";
    this.receiverId = config.receiverId ?? Config.getSurescriptsSftpReceiverId();
  }

  createEnrollment(requester: SurescriptsRequester): Transmission<TransmissionType.Enroll> {
    return this.createTransmission(TransmissionType.Enroll, requester);
  }

  createUnenrollment(requester: SurescriptsRequester): Transmission<TransmissionType.Unenroll> {
    return this.createTransmission(TransmissionType.Unenroll, requester);
  }

  createTransmission<T extends TransmissionType>(
    type: T,
    { npiNumber, cxId }: SurescriptsRequester,
    compression = true
  ): Transmission<T> {
    const transmissionId = this.transmissionIdGenerator();
    const now = new Date();
    const requestFileName = this.getPatientLoadFileName(transmissionId, now, compression);

    return {
      type,
      npiNumber,
      cxId,
      id: transmissionId.toString(),
      idBytes: Array.from(transmissionId),
      timestamp: now.getTime(),
      requestFileName,
      compression: compression ? "gzip" : undefined,
    };
  }

  getPatientLoadFileName(
    transmissionId: Buffer,
    transmissionDate: Date,
    compression = true
  ): string {
    return [
      "Metriport_PMA_",
      dayjs(transmissionDate).utc().format("YYYYMMDD"),
      "-",
      transmissionId.toString(),
      compression ? ".gz" : "",
    ].join("");
  }

  async findVerificationFileName(transmission: Transmission): Promise<string | undefined> {
    const results = await this.list("/from_surescripts", info => {
      return (
        info.name.startsWith(transmission.requestFileName) && info.name.endsWith(".gz-extract.rsp")
      );
    });
    return results[0];
  }

  async findFlatFileResponseName(transmission: Transmission): Promise<string | undefined> {
    const transmissionDateTimeSuffix = [
      "_",
      dayjs(transmission.timestamp).utc().format("YYYYMMDD"),
      dayjs(transmission.timestamp).utc().format("HHmmss"),
      ".gz",
    ].join("");
    const results = await this.list("/from_surescripts", info => {
      return (
        info.name.startsWith(transmission.cxId) && info.name.endsWith(transmissionDateTimeSuffix)
      );
    });
    return results[0];
  }

  generatePatientLoadFile(
    transmission: Transmission<TransmissionType>,
    patients: Patient[]
  ): Buffer {
    if (!canGeneratePatientLoadFile(transmission, patients)) {
      throw new MetriportError("Cannot generate patient load file", "generate_patient_load_file", {
        npiNumber: transmission.npiNumber,
        cxId: transmission.cxId,
        patientCount: patients.length,
      });
    }

    return toSurescriptsPatientLoadFile(this, transmission, patients);
  }

  async writePatientLoadFileToStorage(
    transmission: Transmission<TransmissionType>,
    message: Buffer
  ) {
    const fileName = this.getPatientLoadFileName(
      Buffer.from(transmission.idBytes),
      new Date(transmission.timestamp),
      transmission.compression === "gzip"
    );
    await this.s3.uploadFile({
      bucket: this.bucket,
      key: getS3Key(OUTGOING_NAME, fileName),
      file: message,
    });
  }

  async receiveVerificationResponse(transmission: Transmission<TransmissionType>) {
    const fileName = await this.findVerificationFileName(transmission);
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
    const fileName = await this.findFlatFileResponseName(transmission);
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
    const debug = event.debug ?? console.debug;

    if (event.fromSurescripts) {
      debug("Copying from Surescripts...");
      await this.copyFromSurescripts(event);
    } else if (event.toSurescripts) {
      await this.copyToSurescripts(event);
    } else if (event.fileName) {
      await this.copyFileFromSurescripts(event.fileName, event);
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

    console.log("Found SFTP history with length " + sftpHistory.length);
    const s3Files = await this.s3.listObjects(this.bucket, OUTGOING_NAME + "/");

    for (const s3File of s3Files) {
      if (!s3File.Key) continue;

      const outgoingFileName = s3File.Key.substring(OUTGOING_NAME.length + 1);
      const sftpHistoryName = `${outgoingFileName}.${this.senderId}`;
      if (!sftpHistorySet.has(sftpHistoryName)) {
        console.log("DRY RUN: will copy to Surescripts: " + outgoingFileName);
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
    }
    return content;
  }
}
