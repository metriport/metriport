import Client from "ssh2-sftp-client";
import { Config } from "../../../util/config";
import { createWritableBuffer, SftpConfig } from "../shared";
import { IdGenerator, createIdGenerator } from "../shared";

export interface SurescriptsSftpConfig extends Partial<SftpConfig>, TransmissionConfig {}

export interface TransmissionConfig {
  senderId: string;
  senderPassword: string;
  receiverId?: string;
  version?: string;
}

export interface SftpClient {
  connect(): Promise<void>;
  read(remotePath: string): Promise<Buffer>;
  write(remotePath: string, content: Buffer): Promise<boolean>;
}

export enum TransmissionType {
  Enroll = "ENR",
  Unenroll = "UNR",
}

export interface Transmission<T extends TransmissionType> {
  type: T;
  population: string; // unique population identifier
  id: string;
  date: string;
  time: string;
  compression?: "gzip";
}

const surescriptsHost = "sftp.surescripts.com";
const surescriptsPort = 22;
const surescriptsReceiverId = "S00000000000006";
const surescriptsVersion = "2.0";

class SurescriptsSftpClient implements SftpClient {
  private client: Client;
  private idGenerator: IdGenerator;

  private host: string;
  private port: number;
  private username: string;
  private password: string;
  private senderId: string;
  private senderPassword: string;
  private receiverId: string;
  private version: string;

  constructor(config: SurescriptsSftpConfig) {
    this.client = new Client();
    this.idGenerator = createIdGenerator(10);

    this.host = config.host ?? surescriptsHost;
    this.port = config.port ?? surescriptsPort;
    this.username = config.username ?? "P00000000023456";
    this.password = config.password ?? "M94WJ7CW6H";
    this.senderId = config.senderId;
    this.senderPassword = config.senderPassword;

    this.receiverId =
      config.receiverId ?? Config.getSurescriptsSftpReceiverId() ?? surescriptsReceiverId;
    this.version = config.version ?? Config.getSurescriptsSftpVersion() ?? surescriptsVersion;
  }

  createTransmission<T extends TransmissionType>(type: T, population: string): Transmission<T> {
    const now = new Date();
    const year = now.getFullYear();
    const month = (now.getMonth() + 1).toString().padStart(2, "0");
    const date = now.getDate().toString().padStart(2, "0");
    const hour = now.getHours().toString().padStart(2, "0");
    const minute = now.getMinutes().toString().padStart(2, "0");
    const second = now.getSeconds().toString().padStart(2, "0");
    const centisecond = Math.round(now.getMilliseconds() / 10)
      .toString()
      .padStart(2, "0");

    return {
      type,
      population,
      id: this.idGenerator().toString("ascii"),
      date: [year, month, date].join(""),
      time: [hour, minute, second, centisecond].join(""),
      compression: "gzip",
    };
  }

  getTransmissionHeader(): TransmissionConfig {
    return {
      senderId: this.senderId,
      senderPassword: this.senderPassword,
      receiverId: this.receiverId,
      version: this.version,
    };
  }

  async connect() {
    await this.client.connect({
      host: this.host,
      port: this.port,
      username: this.username,
      password: this.password,
      tryKeyboard: false,
      agentForward: false,
    });
  }

  async read(remotePath: string): Promise<Buffer> {
    const { writable, getBuffer } = createWritableBuffer();
    await this.client.get(remotePath, writable);
    return getBuffer();
  }

  async write(remotePath: string, content: Buffer): Promise<boolean> {
    await this.client.put(content, remotePath);
    return true;
  }
}

export default SurescriptsSftpClient;

// function getTransmissionFileName<T>(transmission: Transmission<T>): string {
//   return `${transmission.population}${transmission.id}${transmission.date}${
//     transmission.compression ? `.${transmission.compression}` : ""
//   }`;
// }
