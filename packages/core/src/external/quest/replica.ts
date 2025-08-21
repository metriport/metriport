import path from "path";
import { MetriportError } from "@metriport/shared";
import { Config } from "../../util/config";
import { S3Replica } from "../sftp/replica/s3";
import { QuestResponseFile, QuestSftpConfig } from "./types";

// In the replica bucket, this is a directory where split documents are stored.
const SOURCE_DOCUMENT_DIRECTORY = "source_document";

export class QuestReplica extends S3Replica {
  private readonly incomingDirectoryName: string;

  constructor(config: Pick<QuestSftpConfig, "replicaBucket" | "replicaBucketRegion"> = {}) {
    super({
      bucketName: config.replicaBucket ?? Config.getQuestReplicaBucketName() ?? "",
      region: config.replicaBucketRegion ?? Config.getAWSRegion(),
    });

    if (!this.bucketName) {
      throw new MetriportError("Quest replica bucket name is not set");
    }

    // Replace leading slash for S3 directory name
    this.incomingDirectoryName = Config.getQuestSftpIncomingDirectory().replace(/^\//, "");
  }

  async listAllResponseFiles(): Promise<QuestResponseFile[]> {
    const responseFilePaths = await this.listFileNames(this.incomingDirectoryName);
    const responseFiles: QuestResponseFile[] = [];
    for (const responseFilePath of responseFilePaths) {
      const fileName = path.basename(responseFilePath);
      const fileContent = await this.readFile(responseFilePath);
      responseFiles.push({
        fileName,
        fileContent,
      });
    }
    return responseFiles;
  }

  async uploadSourceDocument(sourceDocument: QuestResponseFile): Promise<void> {
    await this.writeFile(
      `${SOURCE_DOCUMENT_DIRECTORY}/${sourceDocument.fileName}`,
      sourceDocument.fileContent
    );
  }
}
