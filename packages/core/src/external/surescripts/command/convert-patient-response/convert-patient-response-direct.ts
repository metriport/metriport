import { SurescriptsConvertPatientResponseHandler } from "./convert-patient-response";
import { SurescriptsReplica } from "../../replica";
import {
  SurescriptsConversionBundle,
  SurescriptsFileIdentifier,
  SurescriptsRequester,
} from "../../types";
import { convertPatientResponseToFhirBundle, uploadConversionBundle } from "../../fhir-converter";

export class SurescriptsConvertPatientResponseHandlerDirect
  implements SurescriptsConvertPatientResponseHandler
{
  constructor(private readonly replica: SurescriptsReplica) {}

  async convertPatientResponse(
    params: SurescriptsRequester & SurescriptsFileIdentifier
  ): Promise<SurescriptsConversionBundle | undefined> {
    const { cxId, transmissionId, populationId } = params;
    const responseFileContent = await this.replica.getRawResponseFile({
      transmissionId,
      populationId,
    });
    if (!responseFileContent) {
      return undefined;
    }
    const conversionBundle = await convertPatientResponseToFhirBundle(responseFileContent);
    if (!conversionBundle) return undefined;

    const { patientId, bundle } = conversionBundle;
    await uploadConversionBundle({ bundle, cxId, patientId });
    return conversionBundle;
  }
}
