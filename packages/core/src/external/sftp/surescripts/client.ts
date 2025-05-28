import { Config } from "../../../util/config";
import { IdGenerator, createIdGenerator } from "../id-generator";
import { SftpClient, SftpConfig } from "../client";
import { convertDateToString, convertDateToTimeString } from "@metriport/shared/common/date";

export interface SurescriptsSftpConfig extends Partial<Omit<SftpConfig, "password">> {
  senderId?: string;
  senderPassword?: string;
  receiverId?: string;
  production?: boolean; // defaults to false
  publicKey?: string;
  privateKey?: string;
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
  date: Date;
  dateString: string; // YYYYMMDD
  timeString: string; // HHMMSSCC (with centiseconds)
  requestFileName: string;
  compression?: "gzip" | undefined;
}

export class SurescriptsSftpClient extends SftpClient {
  private transmissionIdGenerator: IdGenerator;

  senderId: string;
  senderPassword: string;
  receiverId: string;
  usage: "test" | "production";

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

    this.senderId = config.senderId ?? Config.getSurescriptsSftpSenderId();
    this.senderPassword = config.senderPassword ?? Config.getSurescriptsSftpSenderPassword();
    this.usage = config.production ? "production" : "test";
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
    const transmissionId = this.transmissionIdGenerator().toString("ascii");
    const now = new Date();
    const dateString = convertDateToString(now);
    const timeString = convertDateToTimeString(now, { includeCentisecond: true });

    const requestFileName = ["Metriport_PMA_", dateString, "-", transmissionId].join("");

    return {
      type,
      npiNumber,
      cxId,
      id: transmissionId,
      date: now,
      dateString,
      timeString,
      requestFileName,
      compression: compression ? "gzip" : undefined,
    };
  }

  getPatientLoadFileName(transmission: Transmission): string {
    return `Metriport_PMA_${convertDateToString(transmission.date)}-${transmission.id}${
      transmission.compression ? "." + transmission.compression : ""
    }`;
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
      transmission.dateString,
      transmission.timeString.substring(0, 6), // remove centiseconds
      ".gz",
    ].join("");
    const results = await this.list("/from_surescripts", info => {
      return (
        info.name.startsWith(transmission.cxId) && info.name.endsWith(transmissionDateTimeSuffix)
      );
    });
    return results[0];
  }
}

export function getPatientLoadFileName<T extends TransmissionType>(
  transmission: Transmission<T>
): string {
  return `Metriport_PMA_${convertDateToString(transmission.date)}${
    transmission.compression ? "." + transmission.compression : ""
  }`;
}
