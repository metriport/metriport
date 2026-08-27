import { MetriportError } from "@metriport/shared";
import { Config } from "../../util/config";
import { SftpClient } from "../sftp/client";
import { SftpConfig } from "../sftp/types";
import { QuestReplica } from "./replica";
import { QuestRosterResult } from "./types";

export type QuestResponseFile = {
  fileName: string;
  fileContent: Buffer;
};

export interface QuestSftpConfig extends Partial<SftpConfig> {
  port?: number;
  local?: boolean;
  localPath?: string;
  replicaBucket?: string;
  replicaBucketRegion?: string;
  outgoingDirectory?: string;
  incomingDirectory?: string;
}

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
   * Uploads a roster file to the Quest SFTP server. If this client is configured
   * with a replica, it will also keep a copy of the file in the S3 replica bucket.
   */
  async uploadRoster(rosterResult: QuestRosterResult): Promise<void> {
    try {
      await this.connect();
      await this.writeToQuest(rosterResult.rosterFileName, rosterResult.rosterContent);
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
  async downloadAllNewResponses(): Promise<QuestResponseFile[]> {
    const newResponses: QuestResponseFile[] = [];
    const responseFileNamesInReplica = await this.listResponseFileNamesFromReplica();
    const alreadyDownloadedFileNames = new Set(responseFileNamesInReplica);
    this.log(`Found ${responseFileNamesInReplica.length} response files in replica`);

    try {
      await this.connect();
      const fileNames = await this.listResponseFileNamesFromQuest();
      this.log(`Found ${fileNames.length} response files in Quest SFTP directory`);

      for (const fileName of fileNames) {
        this.log(`Checking ${fileName}...`);
        if (alreadyDownloadedFileNames.has(fileName)) continue;
        this.log(`Downloading ${fileName}...`);
        const fileContent = await this.readFromQuest(fileName);
        newResponses.push({ fileName, fileContent });
        this.log(`Finished downloading ${fileName}`);
      }
    } catch (error) {
      throw new MetriportError(`Failed to download new Quest responses`, error, {
        context: "QuestSftpClient",
      });
    } finally {
      await this.disconnect();
    }
    return newResponses;
  }

  /**
   * Lists all response file names from the Quest replica.
   */
  private async listResponseFileNamesFromReplica(): Promise<string[]> {
    if (!this.replica) throw new MetriportError("No Quest replica set");
    const incomingDirectoryReplica = this.replica.getReplicaPath(this.incomingDirectory);
    return (await this.replica.listFileNames(incomingDirectoryReplica)).map((fileName: string) =>
      fileName.replace(`${incomingDirectoryReplica}/`, "")
    );
  }

  /**
   * Reads response files directly from the S3 replica by their exact file names.
   * Use this to reprocess files that have already been downloaded.
   */
  async readResponseFilesFromReplica(fileNames: string[]): Promise<QuestResponseFile[]> {
    if (!this.replica) throw new MetriportError("No Quest replica set");
    const responses: QuestResponseFile[] = [];
    for (const fileName of fileNames) {
      const replicaPath = this.replica.getReplicaPath(`${this.incomingDirectory}/${fileName}`);
      this.log(`Reading ${fileName} from replica at ${replicaPath}...`);
      const fileContent = await this.replica.readFile(replicaPath);
      responses.push({ fileName, fileContent });
      this.log(`Finished reading ${fileName} from replica`);
    }
    return responses;
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
