import { BadRequestError, MetriportError } from "@metriport/shared";
import { getSecretValueOrFail } from "../../external/aws/secret-manager";
import { SftpClient } from "../../external/sftp/client";
import { SftpConfig, SftpListFilterFunction } from "../../external/sftp/types";
import { makeSftpListFilter } from "../../external/sftp/client";
import { Config } from "../../util/config";
import {
  decryptGpgBinaryWithPrivateKey,
  getLahiePrivateKeyAndPassphrase,
} from "./hl7-gpg-encryption";
import { buildDayjs } from "@metriport/shared/common/date";

export class LahieSftpIngestionClient extends SftpClient {
  private readonly FILE_FORMAT = "YYYY-MM-DD";
  private readonly overridenLog: typeof console.log;

  private constructor(sftpConfig: SftpConfig, overridenLog: typeof console.log) {
    super(sftpConfig);
    this.overridenLog = overridenLog;

    const region = Config.getAWSRegion();
    const bucketName = Config.getLahieIngestionBucket();

    this.initializeS3Replica({ bucketName, region });
  }

  static async create(
    overridenLog: typeof console.log,
    givenPassword?: string
  ): Promise<LahieSftpIngestionClient> {
    const host = Config.getLahieIngestionHost();
    const port = Config.getLahieIngestionPort();
    const username = Config.getLahieIngestionUsername();
    const password = givenPassword ? givenPassword : await this.getLahiePassword();

    return new LahieSftpIngestionClient(
      {
        host,
        port,
        username,
        password,
      },
      overridenLog
    );
  }

  static async getLahiePassword(): Promise<string> {
    const region = Config.getAWSRegion();
    const passwordArn = Config.getLahieIngestionPasswordArn();
    return await getSecretValueOrFail(passwordArn, region);
  }

  async syncWithDate(remotePath: string, dateTimestamp: string): Promise<string[]> {
    if (!this.replica) {
      throw new BadRequestError("Replica not set", undefined, {
        context: "sftp.client.sync",
      });
    }
    this.overridenLog(`Syncing files in ${remotePath} for files containing ${dateTimestamp}`);
    const filter: SftpListFilterFunction | undefined = makeSftpListFilter({
      contains: dateTimestamp,
    });
    if (!filter) {
      throw new Error(`No filter was created. Date: ${dateTimestamp}`);
    }
    const sftpFileNames = await this.list(remotePath, filter);
    if (sftpFileNames.length === 0) {
      this.overridenLog(`No files found in ${remotePath} for date ${dateTimestamp}`);
      return [];
    }

    const replicaFileNamesWithPath = await this.replica.listFileNames(remotePath);
    const replicaDirectoryLength = remotePath.length + 1;
    const existingReplicaFileNames = new Set(
      replicaFileNamesWithPath.map(fileName => fileName.substring(replicaDirectoryLength))
    );

    const filesSynced: string[] = [];
    for (const sftpFileName of sftpFileNames) {
      if (!existingReplicaFileNames.has(sftpFileName)) {
        this.overridenLog(`File ${sftpFileName} does not exist in replica, syncing...`);
        await this.read(`${remotePath}/${sftpFileName}`);
        filesSynced.push(sftpFileName);
      }
    }
    return filesSynced;
  }

  async safeSyncWithDate(remotePath: string, dateTimestamp?: string): Promise<string[]> {
    this.overridenLog(`Syncing from remotePath: ${remotePath}`);

    const now = dateTimestamp ? dateTimestamp : buildDayjs(Date.now()).format(this.FILE_FORMAT);
    try {
      await this.connect();

      const exists = await this.exists(`${remotePath}/`);
      if (!exists) {
        throw new MetriportError(`Remote path does not exist`, undefined, { remotePath });
      }
      this.overridenLog("Syncing from remote path to Replica");
      const fileNames = await this.syncWithDate(`${remotePath}`, now);
      return fileNames;
    } finally {
      await this.disconnect();
    }
  }

  override async syncFileToReplica(content: Buffer, remotePath: string): Promise<void> {
    this.overridenLog("Found a file to sync to replica");
    if (this.replica) {
      const replicaPath = this.replica.getReplicaPath(remotePath);
      this.overridenLog("Decrypting content");
      const { privateKeyArmored, passphrase } = await getLahiePrivateKeyAndPassphrase();
      const decryptedContent = await decryptGpgBinaryWithPrivateKey(
        content,
        privateKeyArmored,
        passphrase
      );
      this.overridenLog("Syncing decrypted content to replica");
      await this.replica.writeFile(replicaPath, decryptedContent);
    }
  }
}
