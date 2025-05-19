import { Config } from "../../../util/config";
import { IdGenerator, createIdGenerator } from "../id-generator";
import { SftpClient, SftpConfig } from "../client";

export interface SurescriptsSftpConfig extends Partial<SftpConfig> {
  senderId?: string;
  senderPassword?: string;
  receiverId?: string;
  production?: boolean; // defaults to false
}

export enum TransmissionType {
  Enroll = "ENR",
  Unenroll = "UNR",
}

export interface Transmission<T extends TransmissionType> {
  type: T;
  population: string; // unique population identifier
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
      host: Config.getSurescriptsHost(!config.production),
      port: 22,
      username: Config.getSurescriptsSftpSenderId(!config.production) ?? "",
      password: Config.getSurescriptsSftpPublicKey(!config.production) ?? "",
      privateKey: Config.getSurescriptsSftpPrivateKey(!config.production) ?? "",
    });
    this.idGenerator = createIdGenerator(10);

    this.senderId = config.senderId ?? Config.getSurescriptsSftpSenderId(!config.production) ?? "";
    this.senderPassword =
      config.senderPassword ?? Config.getSurescriptsSftpPublicKey(!config.production) ?? "";
    this.usage = config.production ? "production" : "test";
    this.receiverId = config.receiverId ?? Config.getSurescriptsSftpReceiverId(!config.production);
  }

  createTransmission<T extends TransmissionType>(type: T, population: string): Transmission<T> {
    return {
      type,
      population,
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

export default SurescriptsSftpClient;

// function getTransmissionFileName<T>(transmission: Transmission<T>): string {
//   return `${transmission.population}${transmission.id}${transmission.date}${
//     transmission.compression ? `.${transmission.compression}` : ""
//   }`;
// }
