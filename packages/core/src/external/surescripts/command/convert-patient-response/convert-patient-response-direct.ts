import { SurescriptsConvertPatientResponseHandler } from "./convert-patient-response";
import { SurescriptsReplica } from "../../replica";
import { SurescriptsFileIdentifier } from "../../types";
import { convertPatientResponseToFhirBundle } from "../../fhir-converter";

export class SurescriptsConvertPatientResponseHandlerDirect
  implements SurescriptsConvertPatientResponseHandler
{
  constructor(private readonly replica: SurescriptsReplica) {}

  async convertPatientResponse({
    transmissionId,
    populationId,
  }: SurescriptsFileIdentifier): Promise<void> {
    const responseFileContent = await this.replica.getResponseFileContent({
      transmissionId,
      populationId,
    });
    if (!responseFileContent) {
      return;
    }
    await convertPatientResponseToFhirBundle(responseFileContent);
  }
}
