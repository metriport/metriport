import Client from "ssh2-sftp-client";
// import { Config } from '../../../util/config';
import { createWritableBuffer, SftpConfig } from "../shared";

interface SurescriptsSftpConfig extends Partial<SftpConfig> {
  senderId: string;
  senderPassword: string;
  receiverId?: string;
  version?: string;
}

interface SftpClient {
  connect(): Promise<void>;
  read(remotePath: string): Promise<Buffer>;
  write(remotePath: string, content: Buffer): Promise<boolean>;
}

enum TransmissionType {
  Enroll = "ENR",
  Unenroll = "UNR",
}

interface Transmission<T extends TransmissionType> {
  type: T;
  id: string;
  date: string;
  time: string;
}

const surescriptsHost = "sftp.surescripts.com";
const surescriptsPort = 22;
// const surescriptsReceiverId = 'S00000000000006';
// const surescriptsVersion = '2.0';

class SurescriptsSftpClient implements SftpClient {
  private client: Client;

  private host: string;
  private port: number;
  private username: string;
  private password: string;
  // private senderId: string;
  // private senderPassword: string;
  // private receiverId: string;
  // private version: string;

  constructor(config: SurescriptsSftpConfig) {
    this.client = new Client();
    this.host = config.host ?? surescriptsHost;
    this.port = config.port ?? surescriptsPort;
    this.username = config.username ?? "P00000000023456";
    this.password = config.password ?? "M94WJ7CW6H";
    // this.senderId = config.senderId;
    // this.senderPassword = config.senderPassword;

    // this.receiverId = config.receiverId ??
    //   Config.getSurescriptsSftpReceiverId() ??
    //   surescriptsReceiverId;
    // this.version = config.version ??
    //   Config.getSurescriptsSftpVersion() ??
    //   surescriptsVersion;
  }

  createTransmission<T extends TransmissionType>(type: T): Transmission<T> {
    return {
      type,
      id: "TODO",
      date: "TODO",
      time: "TODO",
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
