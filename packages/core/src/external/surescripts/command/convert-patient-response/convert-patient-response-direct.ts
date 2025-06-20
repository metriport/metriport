import { convertPatientResponseToFhirBundle } from "../../fhir-converter";
import { SurescriptsReplica } from "../../replica";
import { SurescriptsConversionBundle, SurescriptsJob } from "../../types";
import { saveBundle } from "../bundle/save-bundle";
import { SurescriptsConvertPatientResponseHandler } from "./convert-patient-response";

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
      return undefined;
    }
    const conversionBundle = await convertPatientResponseToFhirBundle(cxId, responseFileContent);
    if (!conversionBundle) return undefined;

    const { patientId, bundle } = conversionBundle;
    await saveBundle({ bundle, cxId, patientId, jobId: transmissionId });
    return conversionBundle;
  }
}
