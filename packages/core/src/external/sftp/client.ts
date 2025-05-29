import SshSftpClient from "ssh2-sftp-client";
import { gzip, ungzip } from "node-gzip";
import { Writable } from "stream";
import { MetriportError } from "@metriport/shared";

export interface SftpConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  privateKey: string;
}

export interface SftpClientImpl {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  read(remotePath: string): Promise<Buffer>;
  write(remotePath: string, content: Buffer): Promise<void>;
  list(remotePath: string): Promise<string[]>;
  exists(remotePath: string): Promise<boolean>;
}

type SftpExecutionHandler<T> = (this: SftpClient, client: SshSftpClient) => Promise<T>;

export class SftpClient implements SftpClientImpl {
  protected readonly client: SshSftpClient;
  private sshError: unknown[] = [];
  private sshErrorHandler: (error?: unknown) => void;

  protected readonly host: string;
  protected readonly port: number;
  protected readonly username: string;
  protected readonly password: string;
  protected readonly privateKey: string;
  private connected = false;
  private connectionEnded = false;

  constructor({ host, port, username, password, privateKey }: SftpConfig) {
    this.client = new SshSftpClient();
    this.sshErrorHandler = (error?: unknown) => {
      if (error != null) this.sshError.push(error);
    };

    this.host = host;
    this.port = port;
    this.username = username;
    this.password = password;
    this.privateKey = privateKey;
  }

  private async executeWithSshListeners<T, F extends SftpExecutionHandler<T>>(
    executionHandler: F
  ): Promise<T> {
    if (this.connectionEnded) {
      throw new MetriportError(
        "The SftpClient has been disconnected and should not be reused.",
        "disconnected",
        {
          context: "sftp.client.executeWithSshListeners",
        }
      );
    }

    this.sshError = [];
    const result = await executionHandler.call(this, this.client);
    const unexpectedSshError = this.sshError[0];
    if (unexpectedSshError) throw unexpectedSshError;
    return result as T;
  }

  async connect(): Promise<void> {
    await this.executeWithSshListeners(async function (client) {
      await client.connect({
        host: this.host,
        port: this.port,
        username: this.username,
        password: this.password,
        privateKey: this.privateKey,
        tryKeyboard: false,
        agentForward: false,
      });

      client.on("error", this.sshErrorHandler);
      client.on("end", this.sshErrorHandler);
      client.on("close", this.sshErrorHandler);
    });
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    if (!this.connected) return;

    await this.executeWithSshListeners(async function (client) {
      client.removeListener("error", this.sshErrorHandler);
      client.removeListener("end", this.sshErrorHandler);
      client.removeListener("close", this.sshErrorHandler);
      await client.end();
    });

    this.connectionEnded = true;
    this.connected = false;
  }

  async read(
    remotePath: string,
    { decompress = false }: { decompress?: boolean } = {}
  ): Promise<Buffer> {
    const { writable, getBuffer } = createWritableBuffer();
    await this.executeWithSshListeners(async function (client) {
      return client.get(remotePath, writable);
    });
    const content = getBuffer();
    if (decompress) {
      return ungzip(content);
    }
    return content;
  }

  async list(remotePath: string, filter?: SshSftpClient.ListFilterFunction): Promise<string[]> {
    const fileNames: string[] = await this.executeWithSshListeners(async function (client) {
      const files = await client.list(remotePath, filter);
      return files.map(file => file.name);
    });
    return fileNames;
  }

  async exists(remotePath: string): Promise<boolean> {
    const exists = await this.executeWithSshListeners(async function (client) {
      return client.exists(remotePath);
    });
    return exists !== false;
  }

  async write(
    remotePath: string,
    content: Buffer,
    { compress = false }: { compress?: boolean } = {}
  ): Promise<void> {
    if (compress) {
      content = await gzip(content);
    }
    await this.executeWithSshListeners(async function (client) {
      return client.put(content, remotePath);
    });
  }
}

export function createWritableBuffer(): { writable: Writable; getBuffer: () => Buffer } {
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
