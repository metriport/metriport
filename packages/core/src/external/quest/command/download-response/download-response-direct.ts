import { MetriportError } from "@metriport/shared";
import { executeAsynchronously } from "../../../../util/concurrency";
import { QuestSftpClient } from "../../client";
import { QuestReplica } from "../../replica";
import { QuestPatientResponseFile } from "../../types";
import { QuestFhirConverterCommand } from "../fhir-converter/fhir-converter";
import { DownloadResponseCommandHandler } from "./download-response";
import { splitResponseFileIntoSourceDocuments } from "../../source-document";
import { QuestFhirConverterCommandDirect } from "../fhir-converter/fhir-converter-direct";

const numberOfParallelExecutions = 10;

export class DownloadResponseHandlerDirect implements DownloadResponseCommandHandler {
  constructor(
    private readonly client = new QuestSftpClient(),
    private readonly next: QuestFhirConverterCommand = new QuestFhirConverterCommandDirect()
  ) {}

  async downloadAllQuestResponses(): Promise<void> {
    const replica = this.getQuestReplica();
    const responseFiles = await this.client.downloadAllResponses();

    // Generate source documents for each response file that was downloaded.
    const allSourceDocuments: QuestPatientResponseFile[] = [];
    for (const responseFile of responseFiles) {
      const sourceDocuments = splitResponseFileIntoSourceDocuments(responseFile);
      allSourceDocuments.push(...sourceDocuments);
    }

    // Upload all source documents to S3 in parallel, and trigger the next stage of the data
    // pipeline with each source document.
    await executeAsynchronously(
      allSourceDocuments,
      async sourceDocument => {
        await replica.uploadSourceDocument(sourceDocument);
        await this.next.convertSourceDocumentToFhirBundle({
          patientId: sourceDocument.patientId,
          sourceDocumentName: sourceDocument.fileName,
        });
      },
      {
        numberOfParallelExecutions,
        keepExecutingOnError: true,
      }
    );
  }

  /**
   * This handler requires the Quest client to be correctly configured with a QuestReplica instance.
   */
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
