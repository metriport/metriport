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

  private async executeWithSshListeners<T, F extends (client: SshSftpClient) => Promise<T>>(
    executionHandler: F
  ): Promise<T> {
    let executionCompleted = false;
    let executionError: Error | undefined;
    function errorHandler(error?: Error) {
      if (error != null && error instanceof Error) {
        executionError = error;
      } else if (!executionCompleted) {
        executionError = new Error("Socket was closed before execution completed");
      }
    }
    this.client.on("error", errorHandler);
    this.client.on("end", errorHandler);
    this.client.on("close", errorHandler);

    let result: T | undefined;
    try {
      result = await executionHandler(this.client);
      executionCompleted = true;
    } catch (error) {
      if (error instanceof Error) {
        executionError = error;
      } else {
        executionError = new Error(String(error));
      }
    }

    this.client.removeListener("error", errorHandler);
    this.client.removeListener("end", errorHandler);
    this.client.removeListener("close", errorHandler);

    if (executionError) {
      throw executionError;
    }
    return result as T;
  }

  async connect() {
    await this.executeWithSshListeners(client =>
      client.connect({
        host: this.host,
        port: this.port,
        username: this.username,
        password: this.password,
        privateKey: this.privateKey,
        tryKeyboard: false,
        agentForward: false,
      })
    );
  }

  async disconnect() {
    await this.executeWithSshListeners(client => client.end());
  }

  async read(remotePath: string): Promise<Buffer> {
    const { writable, getBuffer } = createWritableBuffer();
    await this.executeWithSshListeners(client => client.get(remotePath, writable));
    return getBuffer();
  }

  async list(remotePath: string): Promise<string[]> {
    const files: string[] = await this.executeWithSshListeners(async client => {
      const files = await client.list(remotePath);
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

  async write(remotePath: string, content: Buffer): Promise<boolean> {
    await this.executeWithSshListeners(client => client.put(content, remotePath));
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
