import { SurescriptsConvertPatientResponseHandler } from "./convert-patient-response";
import { SurescriptsReplica } from "../../replica";
import { SurescriptsConversionBundle, SurescriptsFileIdentifier } from "../../types";
import { convertPatientResponseToFhirBundle } from "../../fhir-converter";

export class SurescriptsConvertPatientResponseHandlerDirect
  implements SurescriptsConvertPatientResponseHandler
{
  constructor(private readonly replica: SurescriptsReplica) {}

  async convertPatientResponse({
    transmissionId,
    populationId,
  }: SurescriptsFileIdentifier): Promise<SurescriptsConversionBundle | undefined> {
    const responseFileContent = await this.replica.getResponseFileContent({
      transmissionId,
      populationId,
    });
    if (!responseFileContent) {
      return undefined;
    }
    return await convertPatientResponseToFhirBundle(responseFileContent);
  }
}
