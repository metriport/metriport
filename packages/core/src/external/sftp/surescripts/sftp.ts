import { Config } from "../../../util/config";
import { IdGenerator, createIdGenerator } from "../id-generator";
import { SftpClient, SftpConfig } from "../client";

export interface SurescriptsSftpConfig extends SftpConfig {
  senderId: string;
  senderPassword: string;
  receiverId?: string;
  version?: "2.0";
  usage?: "test" | "production";
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

const surescriptsReceiverId = "S00000000000006";
const surescriptsVersion = "2.0";

export class SurescriptsSftpClient extends SftpClient {
  private idGenerator: IdGenerator;

  senderId: string;
  senderPassword: string;
  receiverId: string;
  version: "2.0";
  usage: "test" | "production";

  constructor(config: SurescriptsSftpConfig) {
    super(config);
    this.idGenerator = createIdGenerator(10);

    this.senderId = config.senderId;
    this.senderPassword = config.senderPassword;
    this.usage = config.usage ?? "test";
    this.receiverId =
      config.receiverId ?? Config.getSurescriptsSftpReceiverId() ?? surescriptsReceiverId;
    this.version = config.version ?? surescriptsVersion;
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
}

export default SurescriptsSftpClient;

// function getTransmissionFileName<T>(transmission: Transmission<T>): string {
//   return `${transmission.population}${transmission.id}${transmission.date}${
//     transmission.compression ? `.${transmission.compression}` : ""
//   }`;
// }
