import { MetriportError, BadRequestError, errorToString } from "@metriport/shared";
import SshSftpClient from "ssh2-sftp-client";
import { Writable } from "stream";
import { out } from "../../util/log";
import { compressGzip, decompressGzip } from "./compression";
import { LocalReplica } from "./replica/local";
import { S3Replica } from "./replica/s3";
import {
  SftpClientImpl,
  SftpConfig,
  SftpListFilterFunction,
  SftpReadOptions,
  SftpReplica,
  SftpWriteOptions,
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
  private readonly logger: ReturnType<typeof out>;
  protected replica: SftpReplica | undefined;
  private connected = false;
  private connectionEnded = false;

  constructor({ host, port, username, password, privateKey, logLevel = "none" }: SftpConfig) {
    this.client = new SshSftpClient();
    this.sshErrorHandler = (error?: unknown) => {
      if (error) this.sshError.push(error);
    };

    this.host = host;
    this.port = port;
    this.username = username;
    this.password = password;
    this.privateKey = privateKey;
    this.logger = makeLogger(logLevel);
    this.replica = undefined;
  }

  protected setReplica(replica: SftpReplica): void {
    if (this.replica) {
      throw new BadRequestError("Replica already set", undefined, {
        context: "sftp.client.setReplica",
      });
    }
    this.replica = replica;
  }

  protected initializeS3Replica({
    bucketName,
    region,
  }: {
    bucketName: string;
    region: string;
  }): S3Replica {
    const replica = new S3Replica({ bucketName, region });
    this.setReplica(replica);
    return replica;
  }

  protected initializeLocalReplica(localPath: string): LocalReplica {
    const replica = new LocalReplica(localPath);
    this.setReplica(replica);
    return replica;
  }

  private async executeWithSshListeners<T, M extends SftpMethod<T>>(method: M): Promise<T> {
    if (this.connectionEnded) {
      throw new MetriportError("The SftpClient has been disconnected.", undefined, {
        context: "sftp.client.executeWithSshListeners",
      });
    }
    this.sshError = [];
    const result = await method.call(this, this.client);
    const unexpectedSshError = this.sshError[0];
    if (unexpectedSshError) throw unexpectedSshError;
    return result;
  }

  async connect(): Promise<void> {
    if (this.connected) {
      this.debug("Already connected, skipping connect...");
      return;
    }

    this.log("Connecting to SFTP server...");
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

    this.log("Connected to SFTP server.");
    this.connected = true;
  }

  async disconnect(): Promise<void> {
    if (!this.connected) {
      this.debug("Already disconnected, skipping disconnect...");
      return;
    }

    this.log("Disconnecting from SFTP server...");
    await this.executeWithSshListeners(async function (client) {
      client.removeListener("error", this.sshErrorHandler);
      client.removeListener("end", this.sshErrorHandler);
      client.removeListener("close", this.sshErrorHandler);
      await client.end();
    });

    this.log("Disconnected from SFTP server.");
    this.connectionEnded = true;
    this.connected = false;
  }

  async read(
    remotePath: string,
    { decompress = false, overrideReplica = true }: SftpReadOptions = {}
  ): Promise<Buffer> {
    const { writable, getBuffer } = createWritableBuffer();

    this.log(`Reading file from SFTP: ${remotePath}`);
    await this.executeWithSshListeners(async function (client) {
      return client.get(remotePath, writable);
    });

    this.log(`Finished reading from SFTP`);
    let content = getBuffer();
    if (decompress) {
      this.debug(`Decompressing gzip file...`);
      content = await decompressGzip(content);
    }

    if (this.replica && overrideReplica) {
      try {
        const replicaPath = this.replica.getReplicaPath(remotePath);
        await this.replica.writeFile(replicaPath, content);
      } catch (error) {
        this.log(`Error writing file to replica: ${errorToString(error)}`);
      }
    }

    return content;
  }

  async write(
    remotePath: string,
    content: Buffer,
    { compress = false }: SftpWriteOptions = {}
  ): Promise<void> {
    if (compress) {
      this.debug(`Compressing file with gzip...`);
      content = await compressGzip(content);
    }

    this.log(`Writing file to ${remotePath}`);
    await this.executeWithSshListeners(async function (client) {
      return client.put(content, remotePath);
    });
    this.log(`Finished writing file to ${remotePath}`);

    if (this.replica) {
      try {
        const replicaPath = this.replica.getReplicaPath(remotePath);
        await this.replica.writeFile(replicaPath, content);
      } catch (error) {
        this.log(`Error writing file to replica: ${errorToString(error)}`);
      }
    }
  }

  async list(remotePath: string, filter?: SftpListFilterFunction): Promise<string[]> {
    this.log(`Listing files in ${remotePath}`);
    const fileNames: string[] = await this.executeWithSshListeners(async function (client) {
      const files = await client.list(remotePath, filter);
      return files.map(file => file.name);
    });

    this.log(`Found ${fileNames.length} files in ${remotePath}.`);
    return fileNames;
  }

  async sync(remotePath: string): Promise<string[]> {
    if (!this.replica) return [];
    const replicaDirectory = this.replica.getReplicaPath(remotePath);
    this.log(`Syncing files in ${remotePath} to replica at ${replicaDirectory}`);
    const sftpFileNames = await this.list(remotePath);
    const replicaFileNames = await this.replica.listFileNames(replicaDirectory);
    const existingReplicaFileName = new Set(
      replicaFileNames.map(fileName => fileName.substring(replicaDirectory.length + 1))
    );

    const filesSynced: string[] = [];
    for (const sftpFileName of sftpFileNames) {
      if (!existingReplicaFileName.has(sftpFileName)) {
        this.log(`File ${sftpFileName} does not exist in replica, syncing...`);
        const sftpFileContent = await this.read(remotePath + "/" + sftpFileName);
        await this.replica.writeFile(replicaDirectory + "/" + sftpFileName, sftpFileContent);
        filesSynced.push(sftpFileName);
      }
    }
    return filesSynced;
  }

  async exists(remotePath: string): Promise<boolean> {
    this.log(`Checking if file exists at ${remotePath}`);
    const exists = await this.executeWithSshListeners(async function (client) {
      return client.exists(remotePath);
    });
    return exists !== false;
  }

  protected log(message: string, ...optionalParams: unknown[]): void {
    this.logger.log(message, ...optionalParams);
  }

  protected debug(message: string, ...optionalParams: unknown[]): void {
    this.logger.debug(message, ...optionalParams);
  }

  getReplica(): SftpReplica | undefined {
    return this.replica;
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

export function makeSftpListFilter({
  prefix,
  contains,
}: {
  prefix?: string | undefined;
  contains?: string | undefined;
}): SftpListFilterFunction | undefined {
  if (prefix) {
    return file => file.name.startsWith(prefix);
  }
  if (contains) {
    return file => file.name.includes(contains);
  }
  return undefined;
}

function makeLogger(logLevel: "info" | "debug" | "none"): ReturnType<typeof out> {
  if (logLevel === "none") {
    return {
      log: () => {}, //eslint-disable-line @typescript-eslint/no-empty-function
      debug: () => {}, //eslint-disable-line @typescript-eslint/no-empty-function
    };
  }
  if (logLevel === "info") {
    return {
      debug: () => {}, //eslint-disable-line @typescript-eslint/no-empty-function
      log: out("sftp").log,
    };
  }
  return out("sftp");
}
