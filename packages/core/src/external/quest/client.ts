import { BadRequestError, MetriportError } from "@metriport/shared";
import { Config } from "../../util/config";
import { SftpClient } from "../sftp/client";
import { generateQuestRoster } from "./roster";
import { QuestSftpConfig, QuestResponseFile } from "./types";

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

    const replicaBucketName = config.replicaBucket ?? Config.getQuestReplicaBucketName();
    const replicaBucketRegion = config.replicaBucketRegion ?? Config.getAWSRegion();
    if (replicaBucketName) {
      this.initializeS3Replica({
        bucketName: replicaBucketName,
        region: replicaBucketRegion,
      });
    }
  }

  async generateAndUploadRoster(): Promise<void> {
    const { rosterFileName, rosterContent } = await generateQuestRoster();
    try {
      await this.connect();
      await this.writeToQuest(rosterFileName, rosterContent);
    } catch (error) {
      throw new MetriportError(`Failed to upload Quest roster`, error, {
        context: "QuestSftpClient",
      });
    } finally {
      await this.disconnect();
    }
  }

  async downloadAllResponses(): Promise<QuestResponseFile[]> {
    if (!this.replica) {
      throw new BadRequestError("Cannot download daily updates without a configured replica");
    }
    const replicaFileNames = await this.replica.listFileNames(this.incomingDirectory);
    const alreadyDownloadedFileNames = new Set(replicaFileNames);
    const responseFiles: QuestResponseFile[] = [];

    try {
      await this.connect();
      const fileNames = await this.listResponseFileNamesFromQuest();
      this.log(`Found ${fileNames.length} daily updates in Quest SFTP directory`);

      for (const fileName of fileNames) {
        if (alreadyDownloadedFileNames.has(fileName)) continue;
        const fileContent = await this.readFromQuest(fileName);
        responseFiles.push({ fileName, fileContent });
      }
      return responseFiles;
    } catch (error) {
      throw new MetriportError(`Failed to download Quest responses`, error, {
        context: "QuestSftpClient",
      });
    } finally {
      await this.disconnect();
    }
  }

  /**
   * Writes a new roster file to the Quest outgoing directory. This will also keep a copy of the file
   * in the S3 replica bucket.
   */
  async writeToQuest(fileName: string, fileContent: Buffer): Promise<void> {
    await this.write(`${this.outgoingDirectory}/${fileName}`, fileContent);
  }

  /**
   * Reads a file from the Quest SFTP directory. This will automatically write a copy of the file
   * to the S3 replica bucket.
   */
  async readFromQuest(fileName: string): Promise<Buffer> {
    return await this.read(`${this.incomingDirectory}/${fileName}`);
  }

  async listResponseFileNamesFromQuest(): Promise<string[]> {
    return await this.list(this.incomingDirectory);
  }
}
