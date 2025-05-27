import SshSftpClient from "ssh2-sftp-client";
import { gzip, ungzip } from "node-gzip";
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
  disconnect(): Promise<void>;
  read(remotePath: string): Promise<Buffer>;
  write(remotePath: string, content: Buffer): Promise<boolean>;
  list(remotePath: string): Promise<string[]>;
  exists(remotePath: string): Promise<boolean>;
}

export class SftpClient implements SftpClientImpl {
  protected readonly client: SshSftpClient;
  private sshError: Error[] = [];
  private sshErrorHandler: (...args: unknown[]) => void;

  protected readonly host: string;
  protected readonly port: number;
  protected readonly username: string;
  protected readonly password: string;
  protected readonly privateKey: string;
  private connected = false;
  private connectionEnded = false;

  constructor({ host, port, username, password, privateKey }: SftpConfig) {
    this.client = new SshSftpClient();
    this.sshError = [];
    this.sshErrorHandler = (error: unknown) => {
      if (error instanceof Error) {
        this.sshError.push(error);
      } else if (error != null) {
        this.sshError.push(new Error(String(error)));
      }
    };

    this.host = host;
    this.port = port;
    this.username = username;
    this.password = password;
    this.privateKey = privateKey;
  }

  private async executeWithSshListeners<T, F extends (client: SshSftpClient) => Promise<T>>(
    executionHandler: F
  ): Promise<T> {
    if (this.connectionEnded) {
      throw new Error(
        "The SftpClient has been disconnected and should not be reused. Re-initialize a new SftpClient to perform further operations."
      );
    }

    this.sshError = [];
    let executionError: Error | undefined;

    let result: T | undefined;
    try {
      result = await executionHandler(this.client);
    } catch (error) {
      if (error instanceof Error) {
        executionError = error;
      } else if (error != null) {
        executionError = new Error(String(error));
      }
    }

    if (executionError) {
      throw executionError;
    } else if (this.sshError.length > 0) {
      throw this.sshError[0];
    }
    return result as T;
  }

  async connect(): Promise<void> {
    await this.executeWithSshListeners(async client => {
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

    await this.executeWithSshListeners(async client => {
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
    await this.executeWithSshListeners(client => client.get(remotePath, writable));
    const content = getBuffer();
    if (decompress) {
      return ungzip(content);
    }
    return content;
  }

  async list(remotePath: string, filter?: SshSftpClient.ListFilterFunction): Promise<string[]> {
    const files: string[] = await this.executeWithSshListeners(async client => {
      const files = await client.list(remotePath, filter);
      return files.map(file => file.name);
    });
    return files;
  }

  async exists(remotePath: string): Promise<boolean> {
    try {
      const info = await this.executeWithSshListeners(client => client.exists(remotePath));
      return info !== false;
    } catch (error) {
      return false;
    }
  }

  async write(
    remotePath: string,
    content: Buffer,
    { compress = false }: { compress?: boolean } = {}
  ): Promise<boolean> {
    if (compress) {
      content = await gzip(content);
    }
    await this.executeWithSshListeners(client => client.put(content, remotePath));
    return true;
  }
}

// Returns a writable stream and a function to get the joined buffer
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
