import SshSftpClient from "ssh2-sftp-client";
import { Writable } from "stream";
import { MetriportError } from "@metriport/shared";
import { compressGzip, decompressGzip } from "./compression";

import {
  SftpAction,
  SftpListAction,
  SftpClientImpl,
  SftpConfig,
  SftpResult,
  SftpFile,
} from "./types";

type SftpMethod<T> = (this: SftpClient, client: SshSftpClient) => Promise<T>;

export class SftpClient implements SftpClientImpl {
  protected readonly client: SshSftpClient;
  private sshError: unknown[] = [];
  private sshErrorHandler: (error?: unknown) => void;

  protected readonly host: string;
  protected readonly port: number;
  protected readonly username: string;
  protected readonly password: string;
  protected readonly privateKey?: string | undefined;
  private connected = false;
  private connectionEnded = false;

  constructor({ host, port, username, password, privateKey }: SftpConfig) {
    this.client = new SshSftpClient();
    this.sshErrorHandler = (error?: unknown) => {
      if (error) this.sshError.push(error);
    };

    this.host = host;
    this.port = port;
    this.username = username;
    this.password = password;
    this.privateKey = privateKey;
  }

  async execute<A extends SftpAction>(action: A): Promise<SftpResult<A>> {
    switch (action.type) {
      case "read":
        return (await this.read(action.remotePath, action)) as SftpResult<A>;
      case "write":
        return (await this.write(action.remotePath, action.content, action)) as SftpResult<A>;
      case "list":
        return (await this.list(action.remotePath, makeSftpListFilter(action))) as SftpResult<A>;
      case "exists":
        return (await this.exists(action.remotePath)) as SftpResult<A>;
      case "clone":
        return (await this.clone(action.remotePath)) as SftpResult<A>;
    }
  }

  private async executeWithSshListeners<T, M extends SftpMethod<T>>(method: M): Promise<T> {
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
    const result = await method.call(this, this.client);
    const unexpectedSshError = this.sshError[0];
    if (unexpectedSshError) throw unexpectedSshError;
    return result;
  }

  async connect(): Promise<void> {
    await this.executeWithSshListeners(async function (client) {
      await client.connect({
        host: this.host,
        port: this.port,
        username: this.username,
        password: this.password,
        ...(this.privateKey ? { privateKey: this.privateKey } : {}),
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
      return decompressGzip(content);
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

  async clone(remotePath: string): Promise<SftpFile[]> {
    const sftpFileNames = await this.list(remotePath);
    const sftpFiles: SftpFile[] = [];
    for (const sftpFileName of sftpFileNames) {
      const content = await this.read(remotePath + "/" + sftpFileName);
      sftpFiles.push({ fileName: sftpFileName, content });
    }
    return sftpFiles;
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
      content = await compressGzip(content);
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

function makeSftpListFilter({
  prefix,
  contains,
}: Omit<SftpListAction, "type" | "remotePath">): SshSftpClient.ListFilterFunction | undefined {
  if (prefix) {
    return file => file.name.startsWith(prefix);
  }
  if (contains) {
    return file => file.name.includes(contains);
  }
  return undefined;
}
