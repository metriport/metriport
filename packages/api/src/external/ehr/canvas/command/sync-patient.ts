import CanvasApi from "@metriport/core/external/canvas/index";
import { EhrSources } from "@metriport/shared/src/interface/external/shared/ehr/source";
import { processAsyncError } from "@metriport/core/util/error/shared";
import { findOrCreatePatientMapping, getPatientMapping } from "../../../../command/mapping/patient";
import { queryDocumentsAcrossHIEs } from "../../../../command/medical/document/document-query";
import { getPatientOrFail } from "../../../../command/medical/patient/get-patient";
import {
  createMetriportPatientDemosFhir,
  getOrCreateMetriportPatientFhir,
} from "../../shared-fhir";
import { createCanvasClient } from "../shared";

export type SyncCanvasPatientIntoMetriportParams = {
  cxId: string;
  canvasPracticeId: string;
  canvasPatientId: string;
  api?: CanvasApi;
  triggerDq?: boolean;
};

export async function syncCanvasPatientIntoMetriport({
  cxId,
  canvasPracticeId,
  canvasPatientId,
  api,
  triggerDq = false,
}: SyncCanvasPatientIntoMetriportParams): Promise<string> {
  const existingPatient = await getPatientMapping({
    cxId,
    externalId: canvasPatientId,
    source: EhrSources.canvas,
  });
  if (existingPatient) {
    const metriportPatient = await getPatientOrFail({
      cxId,
      id: existingPatient.patientId,
    });
    const metriportPatientId = metriportPatient.id;
    return metriportPatientId;
  }

  const canvasApi = api ?? (await createCanvasClient({ cxId, practiceId: canvasPracticeId }));
  const canvasPatient = await canvasApi.getPatient({ cxId, patientId: canvasPatientId });
  const possibleDemographics = createMetriportPatientDemosFhir(canvasPatient);
  const metriportPatient = await getOrCreateMetriportPatientFhir({
    cxId,
    source: EhrSources.canvas,
    practiceId: canvasPracticeId,
    possibleDemographics,
    externalId: canvasPatientId,
  });
  if (triggerDq) {
    queryDocumentsAcrossHIEs({
      cxId,
      patientId: metriportPatient.id,
    }).catch(processAsyncError(`Canvas queryDocumentsAcrossHIEs`));
  }
  await findOrCreatePatientMapping({
    cxId,
    patientId: metriportPatient.id,
    externalId: canvasPatientId,
    source: EhrSources.canvas,
  });
  return metriportPatient.id;
}
