import { BadRequestError, MetriportError } from "@metriport/shared";
import { getSecretValueOrFail } from "../../../external/aws/secret-manager";
import { SftpClient } from "../../../external/sftp/client";
import { SftpConfig, SftpListFilterFunction } from "../../../external/sftp/types";
import { makeSftpListFilter } from "../../../external/sftp/client";
import { Config } from "../../../util/config";
import { buildDayjs } from "@metriport/shared/common/date";

export class AlohrSftpIngestionClient extends SftpClient {
  private readonly FILE_FORMAT = "YYYY_MM_DD";
  protected override readonly log: typeof console.log;

  private constructor(sftpConfig: SftpConfig, log: typeof console.log) {
    super(sftpConfig);
    this.log = log;

    const region = Config.getAWSRegion();
    const bucketName = Config.getAlohrIngestionBucket();

    this.initializeS3Replica({ bucketName, region });
  }

  static async create(
    log: typeof console.log,
    givenPassword?: string
  ): Promise<AlohrSftpIngestionClient> {
    const sftpConfig = Config.getAlohrIngestionSftpConfig();
    const password = givenPassword ? givenPassword : await this.getAlohrPassword();

    if (!sftpConfig.host || !sftpConfig.port || !sftpConfig.username) {
      throw new MetriportError("Missing required SFTP configuration", undefined, {
        host: sftpConfig.host,
        port: sftpConfig.port,
        username: sftpConfig.username,
      });
    }

    return new AlohrSftpIngestionClient(
      {
        host: sftpConfig.host,
        port: sftpConfig.port,
        username: sftpConfig.username,
        password,
      },
      log
    );
  }

  static async getAlohrPassword(): Promise<string> {
    const region = Config.getAWSRegion();
    const passwordArn = Config.getAlohrIngestionPasswordArn();
    return await getSecretValueOrFail(passwordArn, region);
  }

  async syncWithDate(remotePath: string, dateTimestamp: string): Promise<string[]> {
    if (!this.replica) {
      throw new BadRequestError("Replica not set", undefined, {
        context: "sftp.client.sync",
      });
    }
    this.log(`Syncing files in ${remotePath} for files containing ${dateTimestamp}`);
    const filter: SftpListFilterFunction | undefined = makeSftpListFilter({
      contains: dateTimestamp,
    });
    if (!filter) {
      throw new Error(`No filter was created. Date: ${dateTimestamp}`);
    }
    const sftpFileNames = await this.list(remotePath, filter);
    if (sftpFileNames.length === 0) {
      this.log(`No files found in ${remotePath} for date ${dateTimestamp}`);
      return [];
    }
    const replicaDirectory = this.replica.getReplicaPath(remotePath);
    const replicaFileNamesWithPath = await this.replica.listFileNames(replicaDirectory);
    const replicaDirectoryLength = replicaDirectory.length + 1;
    const existingReplicaFileNames = new Set(
      replicaFileNamesWithPath.map(fileName => fileName.substring(replicaDirectoryLength))
    );

    const filesSynced: string[] = [];
    for (const sftpFileName of sftpFileNames) {
      if (!existingReplicaFileNames.has(sftpFileName)) {
        this.log(`File ${sftpFileName} does not exist in replica, syncing...`);
        await this.read(`${remotePath}/${sftpFileName}`);
        filesSynced.push(sftpFileName);
      }
    }
    return filesSynced;
  }

  async safeSyncWithDate(remotePath: string, dateTimestamp?: string): Promise<string[]> {
    this.log(`Syncing from remotePath: ${remotePath}`);

    const now = dateTimestamp ? dateTimestamp : buildDayjs(Date.now()).format(this.FILE_FORMAT);
    try {
      await this.connect();

      const exists = await this.exists(`${remotePath}/`);
      if (!exists) {
        throw new MetriportError(`Remote path does not exist`, undefined, {
          remotePath,
        });
      }
      this.log("Syncing from remote path to Replica");
      const fileNames = await this.syncWithDate(remotePath, now);
      return fileNames;
    } finally {
      await this.disconnect();
    }
  }
}
