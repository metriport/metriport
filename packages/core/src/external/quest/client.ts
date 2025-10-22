import { MetriportError } from "@metriport/shared";
import { Config } from "../../util/config";
import { SftpClient } from "../sftp/client";
import { generateQuestRoster } from "./roster";
import { QuestSftpConfig, QuestResponseFile, QuestRosterRequest } from "./types";
import { QuestReplica } from "./replica";

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
    if (replicaBucketName) {
      this.setReplica(new QuestReplica(config));
    }
  }

  /**
   * Generates a new roster file and uploads it to the Quest SFTP server. If this client is configured
   * with a replica, it will also upload the roster file to the S3 replica bucket.
   */
  async generateAndUploadRoster({ rosterType }: QuestRosterRequest): Promise<void> {
    const { rosterFileName, rosterContent } = await generateQuestRoster({ rosterType });
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

  /**
   * Downloads all Quest responses from the Quest SFTP server. If this client is configured with a
   * replica, it will only download files that have not already been downloaded to S3.
   */
  async downloadAllResponses(): Promise<QuestResponseFile[]> {
    const responseFileNamesInReplica = await this.listResponseFileNamesFromReplica();
    const alreadyDownloadedFileNames = new Set(responseFileNamesInReplica);

    try {
      await this.connect();
      const fileNames = await this.listResponseFileNamesFromQuest();
      this.log(`Found ${fileNames.length} file updates in Quest SFTP directory`);

      const responseFiles: QuestResponseFile[] = [];
      for (const fileName of fileNames) {
        if (alreadyDownloadedFileNames.has(fileName)) continue;
        this.log(`Downloading ${fileName}...`);
        const fileContent = await this.readFromQuest(fileName);
        responseFiles.push({ fileName, fileContent });
        this.log(`Finished downloading ${fileName}`);
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
   * Lists all response file names from the Quest replica.
   */
  private async listResponseFileNamesFromReplica(): Promise<string[]> {
    if (!this.replica) {
      return [];
    }
    const incomingDirectoryReplica = this.replica.getReplicaPath(this.incomingDirectory);
    return await this.replica.listFileNames(incomingDirectoryReplica);
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
