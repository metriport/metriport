import { Config } from "../../../util/config";
import { IdGenerator, createIdGenerator } from "../id-generator";
import { SftpClient, SftpConfig } from "../client";
import { convertDateToString } from "@metriport/shared/common/date";

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

export interface Transmission<T extends TransmissionType> {
  type: T;
  npiNumber: string;
  cxId: string;
  id: string;
  date: Date;
  compression?: "gzip";
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
    { npiNumber, cxId }: SurescriptsRequester
  ): Transmission<T> {
    return {
      type,
      npiNumber,
      cxId,
      id: this.transmissionIdGenerator().toString("ascii"),
      date: new Date(),
      compression: "gzip",
    };
  }

  getPatientLoadFileName(transmission: Transmission<TransmissionType>): string {
    return `Metriport_PMA_${convertDateToString(transmission.date)}-${transmission.id}${
      transmission.compression ? "." + transmission.compression : ""
    }`;
  }
  // sendTransmission(transmission: Transmission<TransmissionType>): Promise<void> {
  // const message = toSurescriptsMessage(this, transmission.population, transmission.type);
  // return this.write(transmission.id, message);
  // }
}

export function getPatientLoadFileName<T extends TransmissionType>(
  transmission: Transmission<T>
): string {
  return `Metriport_PMA_${convertDateToString(transmission.date)}${
    transmission.compression ? "." + transmission.compression : ""
  }`;
}
