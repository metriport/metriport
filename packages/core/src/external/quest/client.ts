import { Config } from "../../util/config";
import { SftpClient, SftpConfig } from "../sftp/client";
import { INCOMING_NAME, OUTGOING_NAME } from "./constants";
import { getSftpDirectory } from "./shared";
import { Replica } from "../sftp/replica/types";
import { LocalReplica } from "../sftp/replica/local";
import { S3Replica } from "../sftp/replica/s3";
import { toQuestRequestFile, fromQuestResponseFile } from "./message";
import { QuestRequestData } from "./types";
import { lexicalId, LexicalIdGenerator } from "@metriport/shared/common/lexical-id";

export interface QuestSftpConfig extends Partial<SftpConfig> {
  local?: boolean;
  localPath?: string;
  replicaBucket?: string;
  replicaBucketRegion?: string;
}

export class QuestSftpClient extends SftpClient {
  private readonly replica: Replica;
  private readonly generateRequestId: LexicalIdGenerator;

  constructor(config: QuestSftpConfig) {
    super({
      ...config,
      host: config.host ?? Config.getQuestHost(),
      port: 11022,
      username: config.username ?? Config.getQuestSftpUsername(),
      password: config.password ?? Config.getQuestSftpPassword(),
    });

    this.generateRequestId = lexicalId(20);

    this.replica =
      config.local && config.localPath
        ? new LocalReplica(config.localPath)
        : new S3Replica({
            bucketName: config.replicaBucket ?? Config.getQuestReplicaBucketName(),
            region: config.replicaBucketRegion ?? Config.getAWSRegion(),
          });
  }

  async listSftpFiles(): Promise<{ incoming: string[]; outgoing: string[] }> {
    const incoming = await this.list(getSftpDirectory(INCOMING_NAME));
    const outgoing = await this.list(getSftpDirectory(OUTGOING_NAME));
    return { incoming, outgoing };
  }

  async generateAndWriteRequestFile(request: QuestRequestData) {
    const requestId = this.generateRequestId();
    const requestFile = this.generateRequestFile(request);
    await this.replica.writeFile(`${OUTGOING_NAME}/${requestId}`, requestFile, {
      cxId: request.cxId,
    });
  }

  generateRequestFile(request: QuestRequestData) {
    return toQuestRequestFile(request.patient);
  }

  async receiveResponseFile(fileName: string) {
    const responseFile = await this.replica.readFile(fileName);
    return fromQuestResponseFile(responseFile);
  }

  async uploadFileToS3<M extends Record<string, string>>(
    s3Key: string,
    fileContent: Buffer,
    metadata: M
  ): Promise<void> {
    await this.replica.writeFile(s3Key, fileContent, metadata);
  }

  async downloadMetadataFromS3<M extends Record<string, string>>(
    s3Key: string
  ): Promise<M | undefined> {
    const metadata = await this.replica.readFileMetadata<M>(s3Key);
    if (!metadata) {
      return undefined;
    }
    return metadata;
  }

  async fileExistsInS3(s3Key: string): Promise<boolean> {
    return this.replica.hasFile(s3Key);
  }

  async downloadFileFromS3(s3Key: string): Promise<Buffer> {
    return this.replica.readFile(s3Key);
  }
}
