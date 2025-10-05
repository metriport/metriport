import { QuestSourceDocument, QuestResponseFile } from "../../types";
import { executeAsynchronously } from "../../../../util/concurrency";
import {
  splitAllResponseFilesIntoSourceDocuments,
  uploadSourceDocuments,
} from "../../source-document";
import { QuestCreateSourceDocumentsHandler } from "./create-source-documents";
import { QuestFhirConverterCommand } from "../fhir-converter/fhir-converter";
import { QuestFhirConverterCommandDirect } from "../fhir-converter/fhir-converter-direct";
import { QuestReplica } from "../../replica";

const MAX_PARALLEL_CONVERSION_INVOCATIONS = 10;

export class QuestCreateSourceDocumentsHandlerDirect implements QuestCreateSourceDocumentsHandler {
  constructor(
    private readonly next: QuestFhirConverterCommand = new QuestFhirConverterCommandDirect(),
    private readonly replica: QuestReplica = new QuestReplica()
  ) {}

  async createSourceDocuments(responseFiles: QuestResponseFile[]): Promise<QuestSourceDocument[]> {
    const allSourceDocuments = splitAllResponseFilesIntoSourceDocuments(responseFiles);
    await uploadSourceDocuments(this.replica, allSourceDocuments);

    // Trigger the next step of the data pipeline (FHIR conversion) separately for each source document that was generated.
    await executeAsynchronously(
      allSourceDocuments,
      async sourceDocument => {
        await this.next.convertSourceDocumentToFhirBundle({
          externalId: sourceDocument.externalId,
          sourceDocumentKey: sourceDocument.sourceDocumentKey,
        });
      },
      {
        numberOfParallelExecutions: MAX_PARALLEL_CONVERSION_INVOCATIONS,
        keepExecutingOnError: true,
      }
    );
    return allSourceDocuments;
  }
}
