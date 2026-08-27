import { out } from "../../../../util/log";
import { SurescriptsReplica } from "../../replica";
import { buildAndRecreateConsolidatedBundle } from "../bundle/build-and-recreate-consolidated-bundle";
import { buildAndSaveConversionBundle } from "../bundle/build-and-save-conversion-bundle";
import {
  SurescriptsConvertPatientResponseHandler,
  SurescriptsPatientResponse,
} from "./convert-patient-response";

export class SurescriptsConvertPatientResponseHandlerDirect
  implements SurescriptsConvertPatientResponseHandler
{
  constructor(private readonly replica: SurescriptsReplica = new SurescriptsReplica()) {}

  async convertPatientResponse(response: SurescriptsPatientResponse): Promise<void> {
    const { cxId, transmissionId, populationId, patientId, rosterType } = response;
    const { log } = out(
      `ss.convertPatientResponse.direct - cx ${cxId}, roster ${populationId}, transmission ${transmissionId}, pat ${patientId}`
    );
    log(`Converting patient response transmission ${transmissionId}, population ${populationId}`);

    const fileContent = await this.replica.getPatientResponseFile({
      cxId,
      patientId,
      transmissionId,
      populationId,
      rosterType,
    });
    const details = JSON.parse(fileContent.toString());

    await buildAndSaveConversionBundle({
      cxId,
      patientId,
      details,
      rosterId: populationId,
      rosterType,
    });

    await buildAndRecreateConsolidatedBundle({ cxId, patientId, rosterId: populationId });
    log(`Completed conversion of patient response`);
  }
}
