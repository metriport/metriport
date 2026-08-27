import { disableWHMetadata } from "@metriport/core/domain/document-query/trigger-and-query";
import CanvasApi from "@metriport/core/external/ehr/canvas/index";
import { processAsyncError } from "@metriport/core/util/error/shared";
import { CanvasSecondaryMappings } from "@metriport/shared/interface/external/ehr/canvas/cx-mapping";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { findOrCreatePatientMapping, getPatientMapping } from "../../../../command/mapping/patient";
import { queryDocumentsAcrossHIEs } from "../../../../command/medical/document/document-query";
import { getPatientOrFail } from "../../../../command/medical/patient/get-patient";
import { getPatientPrimaryFacilityIdOrFail } from "../../../../command/medical/patient/get-patient-facilities";
import { getCxMappingAndParsedSecondaryMappings } from "../../shared/command/mapping/get-cx-mapping-and-secondary-mappings";
import { getOrCreateMetriportPatientFhir } from "../../shared/command/patient/get-or-create-metriport-patient-fhir";
import { createMetriportPatientDemosFhir } from "../../shared/utils/fhir";
import { isDqCooldownExpired } from "../../shared/utils/patient";
import { createCanvasClient } from "../shared";

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
  const { parsedSecondaryMappings } =
    await getCxMappingAndParsedSecondaryMappings<CanvasSecondaryMappings>({
      ehr: EhrSources.canvas,
      practiceId: canvasPracticeId,
    });
  const shouldDisableWebhooks = !parsedSecondaryMappings.sendDocumentQueryWebhookEnabled;

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
        ...(shouldDisableWebhooks && { cxDocumentRequestMetadata: disableWHMetadata }),
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
      ...(shouldDisableWebhooks && { cxDocumentRequestMetadata: disableWHMetadata }),
    }).catch(processAsyncError(`Canvas queryDocumentsAcrossHIEs`));
  }
  await findOrCreatePatientMapping({
    cxId,
    patientId: metriportPatient.id,
    externalId: canvasPatientId,
    source: EhrSources.canvas,
    secondaryMappings: { practiceId: canvasPracticeId },
  });
  return metriportPatient.id;
}
