import { Config } from "../../util/config";
import { SftpClient } from "../sftp/client";
import { QuestSftpConfig } from "./types";

export class QuestSftpClient extends SftpClient {
  private readonly outgoingDirectory: string;
  private readonly incomingDirectory: string;

  constructor(config: QuestSftpConfig = {}) {
    super({
      ...config,
      host: config.host ?? Config.getQuestSftpHost(),
      port: config.port ?? Config.getQuestSftpPort(),
      username: config.username ?? Config.getQuestSftpUsername(),
      password: config.password ?? Config.getQuestSftpPassword(),
    });
    this.outgoingDirectory = config.outgoingDirectory ?? Config.getQuestSftpOutgoingDirectory();
    this.incomingDirectory = config.incomingDirectory ?? Config.getQuestSftpIncomingDirectory();
    this.initializeS3Replica({
      bucketName: config.replicaBucket ?? Config.getQuestReplicaBucketName(),
      region: config.replicaBucketRegion ?? Config.getAWSRegion(),
    });
  }

  async writeToQuest(fileName: string, fileContent: Buffer): Promise<void> {
    await this.write(`${this.outgoingDirectory}/${fileName}`, fileContent);
  }

  async readFromQuest(fileName: string): Promise<Buffer> {
    return await this.read(`${this.incomingDirectory}/${fileName}`);
  }
}
