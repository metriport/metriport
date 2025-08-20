import { QuestFhirConversionRequest } from "../../types";
import { QuestFhirConverterCommand } from "./fhir-converter";

export class QuestFhirConverterCommandDirect implements QuestFhirConverterCommand {
  async convertSourceDocumentToFhirBundle(request: QuestFhirConversionRequest): Promise<void> {
    // TODO: ENG-864 Implement this for performing a FHIR conversion of the given patient source document
    console.log(`Converting Quest source document to FHIR bundle: ${request.sourceDocumentName}`);
  }
}
