import path from "path";
import { MetriportError } from "@metriport/shared";
import { Config } from "../../util/config";
import { S3Replica } from "../sftp/replica/s3";
import { QuestResponseFile, QuestSftpConfig } from "./types";

// S3 constants for response files and source documents
const RESPONSE_FILE_PREFIX = "/Metriport_";
export const SOURCE_DOCUMENT_DIRECTORY = "source_document";

export class QuestReplica extends S3Replica {
  private readonly incomingResponseFilePrefix: string;

  constructor(
    config: Pick<
      QuestSftpConfig,
      "replicaBucket" | "replicaBucketRegion" | "incomingDirectory"
    > = {}
  ) {
    super({
      bucketName: config.replicaBucket ?? Config.getQuestReplicaBucketName() ?? "",
      region: config.replicaBucketRegion ?? Config.getAWSRegion(),
    });

    if (!this.bucketName) {
      throw new MetriportError("Quest replica bucket name is not set");
    }

    const incomingDirectory = config.incomingDirectory ?? Config.getQuestSftpIncomingDirectory();
    this.incomingResponseFilePrefix = this.getReplicaPath(incomingDirectory) + RESPONSE_FILE_PREFIX;
  }

  async listAllResponseFiles(): Promise<QuestResponseFile[]> {
    const responseFilePaths = await this.listFileNames(this.incomingResponseFilePrefix);
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

  async listAllSourceDocumentKeys(): Promise<string[]> {
    return await this.listFileNames(`${SOURCE_DOCUMENT_DIRECTORY}/`);
  }
}
