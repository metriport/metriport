import SshSftpClient from "ssh2-sftp-client";
import { Writable } from "stream";
import { MetriportError } from "@metriport/shared";
import { out } from "../../util/log";
import { compressGzip, decompressGzip } from "./compression";
import {
  SftpAction,
  SftpListAction,
  SftpClientImpl,
  SftpConfig,
  SftpActionResult,
  SftpFile,
  SftpListFilterFunction,
  SftpReplica,
  SftpReadOptions,
  SftpReplicaActionOptions,
  SftpWriteOptions,
} from "./types";
import { S3Replica } from "./replica/s3";
import { LocalReplica } from "./replica/local";

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

  protected useReplica(replica: SftpReplica): void {
    this.replica = replica;
  }

  protected useS3Replica({ bucketName, region }: { bucketName: string; region: string }): void {
    this.replica = new S3Replica({ bucketName, region });
  }

  protected useLocalReplica(localPath: string): void {
    this.replica = new LocalReplica(localPath);
  }

  async execute<A extends SftpAction>(action: A): Promise<SftpActionResult<A>> {
    try {
      await this.connect();
      switch (action.type) {
        // Simply test if the connection is working
        case "connect":
          return true as SftpActionResult<A>;
        case "read":
          return (await this.read(action.remotePath, action)) as SftpActionResult<A>;
        case "write":
          return (await this.write(
            action.remotePath,
            action.content,
            action
          )) as SftpActionResult<A>;
        case "list":
          return (await this.list(
            action.remotePath,
            makeSftpListFilter(action)
          )) as SftpActionResult<A>;
        case "exists":
          return (await this.exists(action.remotePath)) as SftpActionResult<A>;
        case "clone":
          return (await this.clone(action.remotePath)) as SftpActionResult<A>;
      }
    } finally {
      await this.disconnect();
    }
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
    { decompress = false }: { decompress?: boolean } = {}
  ): Promise<Buffer> {
    const { writable, getBuffer } = createWritableBuffer();

    this.log(`Reading file from ${remotePath}`);
    await this.executeWithSshListeners(async function (client) {
      return client.get(remotePath, writable);
    });

    this.log(`Finished reading from ${remotePath}.`);
    const content = getBuffer();
    if (decompress) {
      this.debug(`Decompressing gzip file...`);
      return decompressGzip(content);
    }
    return content;
  }

  async readThroughReplica(
    remotePath: string,
    {
      decompress = false,
      connect = true,
      disconnect = true,
    }: SftpReadOptions & SftpReplicaActionOptions = {}
  ): Promise<Buffer> {
    if (this.replica) {
      const replicaPath = this.replica.getReplicaPath(remotePath);
      const hasReplicated = await this.replica.hasFile(replicaPath);
      if (hasReplicated) {
        this.log(`Reading file from replica ${replicaPath}`);
        return await this.replica.readFile(replicaPath);
      } else {
        this.debug(`File ${replicaPath} not found in replica, reading from SFTP server...`);
      }
    }

    try {
      if (connect) await this.connect();
      const content = await this.read(remotePath, { decompress });
      if (this.replica) {
        const replicaPath = this.replica.getReplicaPath(remotePath);
        await this.replica.writeFile(replicaPath, content);
      }
      return content;
    } finally {
      if (disconnect) await this.disconnect();
    }
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
  }

  async writeThroughReplica(
    remotePath: string,
    content: Buffer,
    {
      overwrite = false,
      compress = false,
      disconnect = true,
    }: SftpWriteOptions & SftpReplicaActionOptions = {}
  ): Promise<void> {
    if (this.replica) {
      const replicaPath = this.replica.getReplicaPath(remotePath);
      const hasReplicated = await this.replica.hasFile(replicaPath);
      if (hasReplicated && !overwrite) {
        this.log(`File ${replicaPath} already exists in replica, skipping write`);
        return;
      } else {
        this.debug(`Writing file to remote SFTP destination`);
      }
    }

    try {
      await this.connect();
      await this.write(remotePath, content, { compress });

      if (this.replica) {
        this.debug(`SFTP write succeeded, now writing file to replica`);
        const replicaPath = this.replica.getReplicaPath(remotePath);
        await this.replica.writeFile(replicaPath, content);
      }
    } finally {
      if (disconnect) await this.disconnect();
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

  async listWithContainsQuery(remotePath: string, containsQuery: string): Promise<string[]> {
    return this.list(remotePath, makeSftpListFilter({ contains: containsQuery }));
  }

  async listWithPrefix(remotePath: string, prefix: string): Promise<string[]> {
    return this.list(remotePath, makeSftpListFilter({ prefix }));
  }

  async listWithPrefixThroughReplica(
    remotePath: string,
    prefix: string,
    { disconnect = true }: SftpReplicaActionOptions = {}
  ): Promise<string[]> {
    if (this.replica) {
      const existingFiles = await this.replica.listFileNamesWithPrefix(remotePath, prefix);
      if (existingFiles.length > 0) {
        return existingFiles;
      }
    }

    try {
      await this.connect();
      return await this.listWithPrefix(remotePath, prefix);
    } finally {
      if (disconnect) await this.disconnect();
    }
  }

  async clone(remoteDirectory: string): Promise<SftpFile[]> {
    const sftpFileNames = await this.list(remoteDirectory);
    const sftpFiles: SftpFile[] = [];
    for (const sftpFileName of sftpFileNames) {
      this.log(`Copying file ${sftpFileName} from ${remoteDirectory}`);
      const content = await this.read(remoteDirectory + "/" + sftpFileName);
      sftpFiles.push({ fileName: sftpFileName, content });
    }

    this.log(`Finished copying ${sftpFileNames.length} files from ${remoteDirectory}.`);
    return sftpFiles;
  }

  async exists(remotePath: string): Promise<boolean> {
    this.log(`Checking if file exists at ${remotePath}`);
    const exists = await this.executeWithSshListeners(async function (client) {
      return client.exists(remotePath);
    });
    return exists !== false;
  }

  private log(message: string, ...optionalParams: unknown[]): void {
    this.logger.log(message, ...optionalParams);
  }

  private debug(message: string, ...optionalParams: unknown[]): void {
    this.logger.debug(message, ...optionalParams);
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
}: Omit<SftpListAction, "type" | "remotePath">): SftpListFilterFunction | undefined {
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
