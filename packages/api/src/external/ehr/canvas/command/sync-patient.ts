import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { SyncPatientParamsWithPracticeId } from "../../shared/command/sync/sync-patient";
import {
  createMetriportPatientDemosFhir,
  getOrCreateMetriportPatientFhir,
} from "../../shared/utils/fhir";
import { createCanvasClient } from "../shared";

export async function syncCanvasPatientIntoMetriport({
  cxId,
  practiceId,
  ehrPatientId,
}: SyncPatientParamsWithPracticeId): Promise<string> {
  const canvasApi = await createCanvasClient({ cxId, practiceId });
  const canvasPatient = await canvasApi.getPatient({ cxId, patientId: ehrPatientId });
  const possibleDemographics = createMetriportPatientDemosFhir(canvasPatient);
  const metriportPatient = await getOrCreateMetriportPatientFhir({
    cxId,
    source: EhrSources.canvas,
    practiceId,
    possibleDemographics,
    externalId: ehrPatientId,
  });
  return metriportPatient.id;
}
