import { MetriportError } from "@metriport/shared";
import { QuestSftpClient } from "../../client";
import { QuestReplica } from "../../replica";
import { QuestFhirConverterCommand } from "../fhir-converter/fhir-converter";
import { DownloadResponseCommandHandler } from "./download-response";
import { generateSourceDocuments } from "../../source-document";
import { QuestResponseFile } from "../../types";
import { executeAsynchronously } from "@metriport/core/util/concurrency";

const numberOfParallelExecutions = 10;

export class DownloadResponseHandlerDirect implements DownloadResponseCommandHandler {
  constructor(
    private readonly client = new QuestSftpClient(),
    private readonly next: QuestFhirConverterCommand
  ) {}

  async downloadAllQuestResponses(): Promise<void> {
    const replica = this.getQuestReplica();
    const responseFiles = await this.client.downloadAllResponses();

    // Generate source documents for each response file that was downloaded.
    const allSourceDocuments: QuestResponseFile[] = [];
    for (const responseFile of responseFiles) {
      const sourceDocuments = generateSourceDocuments(responseFile);
      allSourceDocuments.push(...sourceDocuments);
    }

    await executeAsynchronously(
      allSourceDocuments,
      async sourceDocument => {
        await replica.uploadSourceDocument(sourceDocument);
        await this.next.convertQuestResponseToFhirBundles(sourceDocument.fileName);
      },
      {
        numberOfParallelExecutions,
        keepExecutingOnError: true,
      }
    );
  }

  private getQuestReplica(): QuestReplica {
    const replica = this.client.getReplica();
    if (!replica || !(replica instanceof QuestReplica)) {
      throw new MetriportError("Quest replica is not correctly initialized", undefined, {
        context: "quest.command.download-response-direct",
      });
    }
    return replica;
  }
}
