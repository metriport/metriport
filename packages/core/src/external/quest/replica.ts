import { MetriportError } from "@metriport/shared";
import { Config } from "../../util/config";
import { S3Replica } from "../sftp/replica/s3";
import { QuestResponseFile, QuestSftpConfig } from "./types";

export class QuestReplica extends S3Replica {
  constructor(config: Pick<QuestSftpConfig, "replicaBucket" | "replicaBucketRegion"> = {}) {
    super({
      bucketName: config.replicaBucket ?? Config.getQuestReplicaBucketName() ?? "",
      region: config.replicaBucketRegion ?? Config.getAWSRegion(),
    });

    if (!this.bucketName) {
      throw new MetriportError("Quest replica bucket name is not set");
    }
  }

  async listAllResponseFiles(): Promise<QuestResponseFile[]> {
    const fileNames = await this.listFileNames(Config.getQuestSftpIncomingDirectory());
    const responseFiles: QuestResponseFile[] = [];
    for (const fileName of fileNames) {
      const fileContent = await this.readFile(fileName);
      responseFiles.push({
        fileName,
        fileContent,
      });
    }
    return responseFiles;
  }

  async uploadSourceDocument(sourceDocument: QuestResponseFile): Promise<void> {
    await this.writeFile(`source_document/${sourceDocument.fileName}`, sourceDocument.fileContent);
  }
}
