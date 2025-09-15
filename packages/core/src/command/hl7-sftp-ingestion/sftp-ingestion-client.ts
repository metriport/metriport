import { MetriportError } from "@metriport/shared";
import { getSecretValueOrFail } from "../../external/aws/secret-manager";
import { SftpClient } from "../../external/sftp/client";
import { SftpConfig } from "../../external/sftp/types";
import { Config } from "../../util/config";
import {
  decryptGpgBinaryWithPrivateKey,
  getLahiePrivateKeyAndPassphrase,
} from "./hl7-sftp-ingestion-direct";

export type ReplicaConfig = { type: "local"; path: string } | { type: "s3"; bucketName: string };

export class SftpIngestionClient extends SftpClient {
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
    isLocal?: boolean
  ): Promise<SftpIngestionClient> {
    const host = Config.getLahieIngestionHost();
    const port = Config.getLahieIngestionPort();
    const username = Config.getLahieIngestionUsername();
    const password = isLocal
      ? SftpIngestionClient.getLocalPassword()
      : await this.getLahiePassword();

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

  static async getLahiePassword(): Promise<string> {
    const region = Config.getAWSRegion();
    const passwordArn = Config.getLahieIngestionPasswordArn();
    return await getSecretValueOrFail(passwordArn, region);
  }

  static getLocalPassword(): string {
    return Config.getLahieIngestionLocalPassword();
  }

  static getLahieReplica(): ReplicaConfig {
    const bucketName = Config.getLahieIngestionBucket();
    return { type: "s3", bucketName };
  }

  async safeSync(remotePath: string): Promise<string[]> {
    this.overridenLog(`Syncing from remotePath: ${remotePath}`);
    try {
      await this.connect();

      const exists = await this.exists(`${remotePath}/`);
      if (!exists) {
        throw new MetriportError(`Remote path does not exist`, undefined, { remotePath });
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
