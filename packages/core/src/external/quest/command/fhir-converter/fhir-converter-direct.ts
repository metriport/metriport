import { QuestFhirConversionRequest } from "../../types";
import { QuestFhirConverterCommand } from "./fhir-converter";
import { convertSourceDocumentToFhirBundle } from "../../fhir-converter";
import { saveBundle } from "../bundle/save-bundle";
import { buildConsolidatedLabBundle } from "../bundle/build-consolidated";
export class QuestFhirConverterCommandDirect implements QuestFhirConverterCommand {
  async convertSourceDocumentToFhirBundle(request: QuestFhirConversionRequest): Promise<void> {
    const response = await convertSourceDocumentToFhirBundle(request);
    await saveBundle(response);
    await buildConsolidatedLabBundle({ cxId: response.cxId, patientId: response.patientId });
  }
}
