import { out, LogFunction } from "../../../../util/log";
import { QuestPatientResponseFile, QuestResponseFile } from "../../types";
import { executeAsynchronously } from "../../../../util/concurrency";
import { splitResponseFileIntoSourceDocuments } from "../../source-document";
import { CreateSourceDocumentsHandler } from "./create-source-documents";
import { QuestFhirConverterCommand } from "../fhir-converter/fhir-converter";
import { QuestFhirConverterCommandDirect } from "../fhir-converter/fhir-converter-direct";
import { QuestReplica } from "../../replica";

export class CreateSourceDocumentsHandlerDirect implements CreateSourceDocumentsHandler {
  private readonly log: LogFunction;
  private readonly debug: LogFunction;
  private readonly numberOfParallelExecutions: number;

  constructor(
    private readonly replica: QuestReplica = new QuestReplica(),
    private readonly next: QuestFhirConverterCommand = new QuestFhirConverterCommandDirect(),
    { numberOfParallelExecutions = 10 }: { numberOfParallelExecutions: number }
  ) {
    this.numberOfParallelExecutions = numberOfParallelExecutions;
    const { log, debug } = out("quest.command.create-source-documents-direct");
    this.log = log;
    this.debug = debug;
  }

  async createSourceDocuments(
    responseFiles: QuestResponseFile[]
  ): Promise<QuestPatientResponseFile[]> {
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
        try {
          await this.replica.uploadSourceDocument(sourceDocument);
          await this.next.convertSourceDocumentToFhirBundle({
            patientId: sourceDocument.patientId,
            sourceDocumentName: sourceDocument.fileName,
          });
        } catch (error) {
          this.debug(`Error processing source document ${sourceDocument.fileName}: ${error}`);
          throw error;
        }
      },
      {
        numberOfParallelExecutions: this.numberOfParallelExecutions,
        keepExecutingOnError: true,
      }
    );
    this.log(
      `Downloaded ${responseFiles.length} response file(s) and uploaded ${allSourceDocuments.length} source documents`
    );

    return allSourceDocuments;
  }
}
