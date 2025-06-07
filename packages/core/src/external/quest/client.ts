import { Config } from "../../util/config";
import { SftpClient, SftpConfig } from "../sftp/client";
import { S3Utils } from "../aws/s3";

export interface QuestSftpConfig extends Partial<SftpConfig> {
  replicaBucket?: string;
  replicaBucketRegion?: string;
}

export class QuestSftpClient extends SftpClient {
  private readonly s3: S3Utils;
  private readonly replicaBucket: string;

  constructor(config: QuestSftpConfig) {
    super({
      ...config,
      host: config.host ?? Config.getQuestHost(),
      port: 11022,
      username: config.username ?? Config.getQuestSftpUsername(),
      password: config.password ?? Config.getQuestSftpPassword(),
    });

    this.s3 = new S3Utils(config.replicaBucketRegion ?? Config.getAWSRegion());
    this.replicaBucket = config.replicaBucket ?? Config.getQuestReplicaBucketName();
  }

  async generateAndWriteRequestFile() {
    throw new Error("unimplemented");
  }

  async generateRequestFile() {
    throw new Error("unimplemented");
  }

  async writeRequestFileToS3() {
    throw new Error("unimplemented");
  }

  async receiveResponseFile() {
    throw new Error("unimplemented");
  }

  async uploadFileToS3<M extends Record<string, string>>(
    s3Key: string,
    fileContent: Buffer,
    metadata: M
  ): Promise<void> {
    await this.s3.uploadFile({
      bucket: this.replicaBucket,
      key: s3Key,
      file: fileContent,
      metadata,
    });
  }

  async downloadMetadataFromS3<M extends Record<string, string>>(
    s3Key: string
  ): Promise<M | undefined> {
    const fileInfo = await this.s3.getFileInfoFromS3(s3Key, this.replicaBucket);
    if (!fileInfo.exists || !fileInfo.metadata) {
      return undefined;
    }
    return fileInfo.metadata as M;
  }

  async fileExistsInS3(s3Key: string): Promise<boolean> {
    const fileInfo = await this.s3.getFileInfoFromS3(s3Key, this.replicaBucket);
    return fileInfo.exists;
  }

  async downloadFileFromS3(s3Key: string): Promise<Buffer> {
    const fileContent = await this.s3.downloadFile({
      bucket: this.replicaBucket,
      key: s3Key,
    });
    return fileContent;
  }
}
