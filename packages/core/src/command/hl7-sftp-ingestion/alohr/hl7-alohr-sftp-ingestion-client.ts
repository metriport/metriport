import { BadRequestError, MetriportError } from "@metriport/shared";
import { getSecretValueOrFail } from "../../../external/aws/secret-manager";
import { SftpClient } from "../../../external/sftp/client";
import { SftpConfig } from "../../../external/sftp/types";
import { Config } from "../../../util/config";
import { sftpConfigSchema } from "../sftp-config";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
dayjs.extend(timezone);

export class AlohrSftpIngestionClient extends SftpClient {
  private readonly FILE_FORMAT = "YYYYMMDD";
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
    const sftpConfig = sftpConfigSchema.parse(Config.getAlohrIngestionSftpConfig());
    const password = givenPassword ? givenPassword : await this.getAlohrPassword();

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

  async syncWithDate(remotePath: string, start: string, end: string): Promise<string[]> {
    if (!this.replica) {
      throw new BadRequestError("Replica not set", undefined, {
        context: "sftp.client.sync",
      });
    }
    this.log(`Syncing files in ${remotePath} for files between ${start} and ${end}`);

    const allFileNames = await this.list(remotePath);
    const sftpFileNames = allFileNames.filter(fileName => {
      const dateMatch = fileName.match(/\d{8}/);
      if (!dateMatch) return false;

      const fileDate = dateMatch[0];
      return fileDate >= start && fileDate < end;
    });

    if (sftpFileNames.length === 0) {
      this.log(`No files found in ${remotePath} for date range ${start} to ${end}`);
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

  async safeSyncWithDate(
    remotePath: string,
    startingDate?: string,
    endingDate?: string
  ): Promise<string[]> {
    this.log(`Syncing from remotePath: ${remotePath}`);
    const start = startingDate
      ? startingDate
      : dayjs.tz(Date.now(), Config.getAlohrIngestionTimezone()).format(this.FILE_FORMAT);
    const end = endingDate
      ? endingDate
      : dayjs
          .tz(Date.now(), Config.getAlohrIngestionTimezone())
          .add(1, "day")
          .format(this.FILE_FORMAT);
    try {
      await this.connect();

      const exists = await this.exists(`${remotePath}/`);
      if (!exists) {
        throw new MetriportError(`Remote path does not exist`, undefined, {
          remotePath,
        });
      }
      this.log("Syncing from remote path to Replica");
      const fileNames = await this.syncWithDate(remotePath, start, end);
      return fileNames;
    } finally {
      await this.disconnect();
    }
  }
}
