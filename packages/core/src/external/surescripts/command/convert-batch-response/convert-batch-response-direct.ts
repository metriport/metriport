import { NotFoundError } from "@metriport/shared";
import { SurescriptsConvertBatchResponseHandler } from "./convert-batch-response";
import { SurescriptsReplica } from "../../replica";
import { SurescriptsConversionBundle, SurescriptsJob } from "../../types";
import { convertBatchResponseToFhirBundles } from "../../fhir-converter";
import { saveBundle } from "../bundle/save-bundle";

export class SurescriptsConvertBatchResponseHandlerDirect
  implements SurescriptsConvertBatchResponseHandler
{
  constructor(private readonly replica: SurescriptsReplica = new SurescriptsReplica()) {}

  async convertBatchResponse(job: SurescriptsJob): Promise<SurescriptsConversionBundle[]> {
    const { cxId, transmissionId, populationId } = job;
    const responseFileContent = await this.replica.getRawResponseFile({
      transmissionId,
      populationId,
    });

    if (!responseFileContent) {
      throw new NotFoundError(
        `No response file stored for transmissionId: ${transmissionId} and populationId: ${populationId}`,
        undefined,
        {
          transmissionId,
          populationId,
        }
      );
    }

    const conversionBundles = await convertBatchResponseToFhirBundles(cxId, responseFileContent);
    for (const { patientId, bundle } of conversionBundles) {
      await saveBundle({ bundle, cxId, patientId, jobId: transmissionId });
    }
    return conversionBundles;
  }
}
