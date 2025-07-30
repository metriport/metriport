import CanvasApi from "@metriport/core/external/ehr/canvas/index";
import { processAsyncError } from "@metriport/core/util/error/shared";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { findOrCreatePatientMapping, getPatientMapping } from "../../../../command/mapping/patient";
import { queryDocumentsAcrossHIEs } from "../../../../command/medical/document/document-query";
import { getPatientOrFail } from "../../../../command/medical/patient/get-patient";
import {
  createMetriportPatientDemosFhir,
  getOrCreateMetriportPatientFhir,
} from "../../shared/utils/fhir";
import { isDqCooldownExpired } from "../../shared/utils/patient";
import { createCanvasClient } from "../shared";
import { getPatientPrimaryFacilityIdOrFail } from "../../../../command/medical/patient/get-patient-facilities";

export type SyncCanvasPatientIntoMetriportParams = {
  cxId: string;
  canvasPracticeId: string;
  canvasPatientId: string;
  api?: CanvasApi;
  triggerDq?: boolean;
  triggerDqForExistingPatient?: boolean;
};

export async function syncCanvasPatientIntoMetriport({
  cxId,
  canvasPracticeId,
  canvasPatientId,
  api,
  triggerDq = false,
  triggerDqForExistingPatient = false,
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
    const facilityId = await getPatientPrimaryFacilityIdOrFail({
      cxId,
      patientId: metriportPatient.id,
    });
    if (triggerDqForExistingPatient && isDqCooldownExpired(metriportPatient)) {
      queryDocumentsAcrossHIEs({
        cxId,
        patientId: metriportPatient.id,
        facilityId,
      }).catch(processAsyncError(`Canvas queryDocumentsAcrossHIEs`));
    }
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
  const facilityId = await getPatientPrimaryFacilityIdOrFail({
    cxId,
    patientId: metriportPatient.id,
  });
  if (triggerDq) {
    queryDocumentsAcrossHIEs({
      cxId,
      patientId: metriportPatient.id,
      facilityId,
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
