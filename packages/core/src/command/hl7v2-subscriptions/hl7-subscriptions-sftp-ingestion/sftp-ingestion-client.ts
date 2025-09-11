import { getSecretValueOrFail } from "../../../external/aws/secret-manager";
import { SftpClient } from "../../../external/sftp/client";
import { SftpConfig } from "../../../external/sftp/types";
import { Config } from "../../../util/config";
import { decryptGpgBinaryWithPrivateKey } from "./hl7-subscriptions-sftp-ingestion-direct";

export type ReplicaConfig = { type: "local"; path: string } | { type: "s3"; bucketName: string };

export class SftpIngestionClient extends SftpClient {
  private static readonly LOCAL_PASSWORD = Config.getLaHieIngestionPassword();
  private readonly overridenLog: typeof console.log;

  private constructor(sftpConfig: SftpConfig, overridenLog: typeof console.log) {
    super(sftpConfig);
    this.overridenLog = overridenLog;

    const region = Config.getAWSRegion();
    const bucketName = Config.getLaHieIngestionBucket();

    this.initializeS3Replica({ bucketName, region });
  }

  static async create(
    overridenLog: typeof console.log,
    isLocal?: boolean
  ): Promise<SftpIngestionClient> {
    const host = Config.getLaHieIngestionHost();
    const port = Config.getLaHieIngestionPort();
    const username = Config.getLaHieIngestionUsername();
    const password = isLocal ? this.LOCAL_PASSWORD : await this.getLaHiePassword();

    return new SftpIngestionClient(
      {
        host,
        port,
        username,
        password,
      },
      overridenLog
    );
  }

  static async getLaHiePassword(): Promise<string> {
    const region = Config.getAWSRegion();
    const passwordArn = Config.getLaHieIngestionPassword();
    return await getSecretValueOrFail(passwordArn, region);
  }

  static getLaHieReplica(): ReplicaConfig {
    const bucketName = Config.getLaHieIngestionBucket();
    return { type: "s3", bucketName };
  }

  async safeSync(remotePath: string): Promise<string[]> {
    this.overridenLog(`Syncing from remotePath: ${remotePath}`);
    try {
      await this.connect();

      const exists = await this.exists(`${remotePath}/`);
      if (!exists) {
        throw new Error("Remote path does not exist");
      }
      this.overridenLog("Syncing from remote path to Replica");
      const fileNames = await this.sync(`${remotePath}`);
      return fileNames;
    } finally {
      await this.disconnect();
    }
  }

  override async syncFileToReplica(content: Buffer, remotePath: string): Promise<void> {
    this.overridenLog("Found a file to sync to replica");
    if (this.replica) {
      try {
        const replicaPath = this.replica.getReplicaPath(remotePath);
        this.overridenLog("Decrypting content");
        const decryptedContent = await decryptGpgBinaryWithPrivateKey(content);

        this.overridenLog("Syncing decrypted content to replica");
        await this.replica.writeFile(replicaPath, decryptedContent);
      } catch (error) {
        this.overridenLog(`Error writing file to replica: ${error}`);
      }
    }
  }
}
