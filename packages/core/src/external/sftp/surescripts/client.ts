import { Config } from "../../../util/config";
import { IdGenerator, createIdGenerator } from "../id-generator";
import { SftpClient, SftpConfig } from "../client";
import { dateToString } from "./schema/shared";

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

export interface Transmission<T extends TransmissionType> {
  type: T;
  npiNumber: string;
  cxId: string;
  id: string;
  date: Date;
  compression?: "gzip";
}

export class SurescriptsSftpClient extends SftpClient {
  private idGenerator: IdGenerator;

  senderId: string;
  senderPassword: string;
  receiverId: string;
  usage: "test" | "production";

  constructor(config: SurescriptsSftpConfig) {
    super({
      ...config,
      host: Config.getSurescriptsHost(),
      port: 22,
      username: Config.getSurescriptsSftpSenderId(),
      password: config.publicKey ?? Config.getSurescriptsSftpPublicKey(),
      privateKey: config.privateKey ?? Config.getSurescriptsSftpPrivateKey(),
    });

    // 10 byte ID generator
    this.idGenerator = createIdGenerator(10);

    this.senderId = config.senderId ?? Config.getSurescriptsSftpSenderId();
    this.senderPassword = config.senderPassword ?? Config.getSurescriptsSftpSenderPassword();
    this.usage = config.production ? "production" : "test";
    this.receiverId = config.receiverId ?? Config.getSurescriptsSftpReceiverId();
  }

  createTransmission<T extends TransmissionType>(
    type: T,
    { npiNumber, cxId }: { npiNumber: string; cxId: string }
  ): Transmission<T> {
    return {
      type,
      npiNumber,
      cxId,
      id: this.idGenerator().toString("ascii"),
      date: new Date(),
      compression: "gzip",
    };
  }

  // sendTransmission(transmission: Transmission<TransmissionType>): Promise<void> {
  // const message = toSurescriptsMessage(this, transmission.population, transmission.type);
  // return this.write(transmission.id, message);
  // }
}

export function getPatientLoadFileName<T extends TransmissionType>(
  transmission: Transmission<T>
): string {
  return `Metriport_PMA_${dateToString(transmission.date)}${
    transmission.compression ? "." + transmission.compression : ""
  }`;
}
