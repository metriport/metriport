import { NotFoundError } from "@metriport/shared";
import { SurescriptsConvertPatientResponseHandler } from "./convert-patient-response";
import { SurescriptsReplica } from "../../replica";
import { SurescriptsConversionBundle, SurescriptsJob } from "../../types";
import { convertPatientResponseToFhirBundle, uploadConversionBundle } from "../../fhir-converter";

export class SurescriptsConvertPatientResponseHandlerDirect
  implements SurescriptsConvertPatientResponseHandler
{
  constructor(private readonly replica: SurescriptsReplica = new SurescriptsReplica()) {}

  async convertPatientResponse(
    job: SurescriptsJob
  ): Promise<SurescriptsConversionBundle | undefined> {
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
    const conversionBundle = await convertPatientResponseToFhirBundle(responseFileContent);
    if (!conversionBundle) return undefined;

    const { patientId, bundle } = conversionBundle;
    await uploadConversionBundle({ bundle, cxId, patientId, transmissionId });
    return conversionBundle;
  }
}
