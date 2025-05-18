import SshSftpClient from "ssh2-sftp-client";
import { Writable } from "stream";

export interface SftpConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  privateKey: string;
}

export interface SftpClientImpl {
  connect(): Promise<void>;
  read(remotePath: string): Promise<Buffer>;
  write(remotePath: string, content: Buffer): Promise<boolean>;
  list(remotePath: string): Promise<string[]>;
  exists(remotePath: string): Promise<boolean>;
}

export class SftpClient implements SftpClientImpl {
  protected readonly client: SshSftpClient;

  protected readonly host: string;
  protected readonly port: number;
  protected readonly username: string;
  protected readonly password: string;
  protected readonly privateKey: string;

  constructor({ host, port, username, password, privateKey }: SftpConfig) {
    this.client = new SshSftpClient();

    this.host = host;
    this.port = port;
    this.username = username;
    this.password = password;
    this.privateKey = privateKey;
  }

  async connect() {
    await this.client.connect({
      host: this.host,
      port: this.port,
      username: this.username,
      password: this.password,
      privateKey: this.privateKey,
      tryKeyboard: false,
      agentForward: false,
    });
  }

  async read(remotePath: string): Promise<Buffer> {
    const { writable, getBuffer } = createWritableBuffer();
    await this.client.get(remotePath, writable);
    return getBuffer();
  }

  async list(remotePath: string): Promise<string[]> {
    const files = await this.client.list(remotePath);
    return files.map(file => file.name);
  }

  async exists(remotePath: string): Promise<boolean> {
    try {
      const info = await this.client.exists(remotePath);
      return info !== false;
    } catch (error) {
      return false;
    }
  }

  async write(remotePath: string, content: Buffer): Promise<boolean> {
    await this.client.put(content, remotePath);
    return true;
  }
}

// Returns a writable stream and a function to get the joined buffer
export function createWritableBuffer() {
  const chunks: Buffer[] = [];

  const writable = new Writable({
    write(chunk: Buffer, _: string, callback: () => void) {
      chunks.push(chunk);
      callback();
    },
  });

  const getBuffer = () => Buffer.concat(chunks);
  return { writable, getBuffer };
}
