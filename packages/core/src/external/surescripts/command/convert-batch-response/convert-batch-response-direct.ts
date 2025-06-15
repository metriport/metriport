import { SurescriptsConvertBatchResponseHandler } from "./convert-batch-response";
import { SurescriptsReplica } from "../../replica";
import { SurescriptsConversionBundle, SurescriptsFileIdentifier } from "../../types";
import { convertBatchResponseToFhirBundles } from "../../fhir-converter";

export class SurescriptsConvertBatchResponseHandlerDirect
  implements SurescriptsConvertBatchResponseHandler
{
  constructor(private readonly replica: SurescriptsReplica) {}

  async convertBatchResponse({
    transmissionId,
    populationId,
  }: SurescriptsFileIdentifier): Promise<SurescriptsConversionBundle[]> {
    const responseFileContent = await this.replica.getResponseFileContent({
      transmissionId,
      populationId,
    });
    if (!responseFileContent) {
      return [];
    }
    return await convertBatchResponseToFhirBundles(responseFileContent);
  }
}
