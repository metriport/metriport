import { QuestFhirConversionRequest } from "../../types";

export interface QuestFhirConverterCommand {
  convertSourceDocumentToFhirBundle(request: QuestFhirConversionRequest): Promise<void>;
}
