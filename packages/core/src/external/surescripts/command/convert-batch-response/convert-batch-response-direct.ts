import { MetriportError } from "@metriport/shared";
import { SurescriptsConvertBatchResponseHandler } from "./convert-batch-response";
import { SurescriptsReplica } from "../../replica";
import {
  SurescriptsConversionBundle,
  SurescriptsFileIdentifier,
  SurescriptsRequester,
} from "../../types";
import { convertBatchResponseToFhirBundles, uploadConversionBundle } from "../../fhir-converter";

export class SurescriptsConvertBatchResponseHandlerDirect
  implements SurescriptsConvertBatchResponseHandler
{
  constructor(private readonly replica: SurescriptsReplica) {}

  async convertBatchResponse({
    cxId,
    transmissionId,
    populationId,
  }: SurescriptsRequester & SurescriptsFileIdentifier): Promise<SurescriptsConversionBundle[]> {
    const responseFileContent = await this.replica.getRawResponseFile({
      transmissionId,
      populationId,
    });
    if (!responseFileContent) {
      throw new MetriportError(
        `No response file stored for transmissionId: ${transmissionId} and populationId: ${populationId}`,
        undefined,
        {
          transmissionId,
          populationId,
        }
      );
    }

    const conversionBundles = await convertBatchResponseToFhirBundles(responseFileContent);
    for (const { patientId, bundle } of conversionBundles) {
      await uploadConversionBundle({ bundle, cxId, patientId });
    }
    return conversionBundles;
  }
}
