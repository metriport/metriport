import { MetriportError } from "@metriport/shared";
import { executeAsynchronously } from "../../../../util/concurrency";
import { out, LogFunction } from "../../../../util/log";
import { QuestSftpClient } from "../../client";
import { QuestReplica } from "../../replica";
import { QuestPatientResponseFile } from "../../types";
import { QuestFhirConverterCommand } from "../fhir-converter/fhir-converter";
import { DownloadResponseCommandHandler } from "./download-response";
import { splitResponseFileIntoSourceDocuments } from "../../source-document";
import { QuestFhirConverterCommandDirect } from "../fhir-converter/fhir-converter-direct";

const numberOfParallelExecutions = 10;

export class DownloadResponseHandlerDirect implements DownloadResponseCommandHandler {
  private readonly log: LogFunction;
  private readonly debug: LogFunction;

  constructor(
    private readonly client = new QuestSftpClient(),
    private readonly next: QuestFhirConverterCommand = new QuestFhirConverterCommandDirect()
  ) {
    const { log, debug } = out("quest.command.download-response-direct");
    this.log = log;
    this.debug = debug;
  }

  async downloadAllQuestResponses(): Promise<void> {
    const replica = this.getQuestReplica();
    const responseFiles = await this.client.downloadAllResponses();

    this.log(`Generating source documents for ${responseFiles.length} response file(s)`);
    const allSourceDocuments: QuestPatientResponseFile[] = [];
    for (const responseFile of responseFiles) {
      const sourceDocuments = splitResponseFileIntoSourceDocuments(responseFile);
      allSourceDocuments.push(...sourceDocuments);
    }

    this.log(`Uploading ${allSourceDocuments.length} source documents to Quest replica`);
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
    this.log(
      `Downloaded ${responseFiles.length} response file(s) and uploaded ${allSourceDocuments.length} source documents`
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
