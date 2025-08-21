import { QuestPatientResponseFile, QuestResponseFile } from "../../types";
import {
  splitAllResponseFilesIntoSourceDocuments,
  uploadSourceDocuments,
} from "../../source-document";
import { QuestCreateSourceDocumentsHandler } from "./create-source-documents";
import { QuestFhirConverterCommand } from "../fhir-converter/fhir-converter";
import { QuestFhirConverterCommandDirect } from "../fhir-converter/fhir-converter-direct";
import { QuestReplica } from "../../replica";

export class QuestCreateSourceDocumentsHandlerDirect implements QuestCreateSourceDocumentsHandler {
  constructor(
    private readonly replica: QuestReplica = new QuestReplica(),
    private readonly next: QuestFhirConverterCommand = new QuestFhirConverterCommandDirect()
  ) {}

  async createSourceDocuments(
    responseFiles: QuestResponseFile[]
  ): Promise<QuestPatientResponseFile[]> {
    const allSourceDocuments = splitAllResponseFilesIntoSourceDocuments(responseFiles);
    await uploadSourceDocuments(this.replica, allSourceDocuments);

    // Trigger the next step of the data pipeline (FHIR conversion) separately
    // for each source document that was generated.
    for (const sourceDocument of allSourceDocuments) {
      await this.next.convertSourceDocumentToFhirBundle({
        patientId: sourceDocument.patientId,
        sourceDocumentName: sourceDocument.fileName,
      });
    }
    return allSourceDocuments;
  }
}
