import { disableWHMetadata } from "@metriport/core/domain/document-query/trigger-and-query";
import PracticeFusionApi from "@metriport/core/external/ehr/practicefusion/index";
import { processAsyncError } from "@metriport/core/util/error/shared";
import { out } from "@metriport/core/util/log";
import { PracticeFusionSecondaryMappings } from "@metriport/shared/interface/external/ehr/practicefusion/cx-mapping";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { findOrCreatePatientMapping, getPatientMapping } from "../../../../command/mapping/patient";
import { queryDocumentsAcrossHIEs } from "../../../../command/medical/document/document-query";
import { getPatientOrFail } from "../../../../command/medical/patient/get-patient";
import { getPatientPrimaryFacilityIdOrFail } from "../../../../command/medical/patient/get-patient-facilities";
import { getCxMappingAndParsedSecondaryMappings } from "../../shared/command/mapping/get-cx-mapping-and-secondary-mappings";
import { getOrCreateMetriportPatientFhir } from "../../shared/command/patient/get-or-create-metriport-patient-fhir";
import { createMetriportPatientDemosFhir } from "../../shared/utils/fhir";
import { createPracticeFusionClient } from "../shared";

export type SyncPracticeFusionPatientIntoMetriportParams = {
  cxId: string;
  practicefusionPracticeId: string;
  practicefusionPatientId: string;
  api?: PracticeFusionApi;
  triggerDq?: boolean;
};

export async function syncPracticeFusionPatientIntoMetriport({
  cxId,
  practicefusionPracticeId,
  practicefusionPatientId,
  api,
  triggerDq = false,
}: SyncPracticeFusionPatientIntoMetriportParams): Promise<string> {
  const { log } = out(
    `syncPracticeFusionPatientIntoMetriport - practiceId: ${practicefusionPracticeId} ptId: ${practicefusionPatientId}`
  );
  const existingPatient = await getPatientMapping({
    cxId,
    externalId: practicefusionPatientId,
    source: EhrSources.practicefusion,
  });
  if (existingPatient) {
    log("existing patient mapping found", existingPatient.patientId);
    const metriportPatient = await getPatientOrFail({
      cxId,
      id: existingPatient.patientId,
    });
    return metriportPatient.id;
  }
  log("no existing mapping found, creating new patient");
  const { parsedSecondaryMappings } =
    await getCxMappingAndParsedSecondaryMappings<PracticeFusionSecondaryMappings>({
      ehr: EhrSources.practicefusion,
      practiceId: practicefusionPracticeId,
    });
  const shouldDisableWebhooks = !parsedSecondaryMappings.sendDocumentQueryWebhookEnabled;
  const practicefusionApi =
    api ?? (await createPracticeFusionClient({ cxId, practiceId: practicefusionPracticeId }));
  const practicefusionPatient = await practicefusionApi.getPatient({
    cxId,
    patientId: practicefusionPatientId,
  });
  const possibleDemographics = createMetriportPatientDemosFhir(practicefusionPatient);
  const metriportPatient = await getOrCreateMetriportPatientFhir({
    cxId,
    source: EhrSources.practicefusion,
    practiceId: practicefusionPracticeId,
    possibleDemographics,
    externalId: practicefusionPatientId,
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
    }).catch(processAsyncError(`PracticeFusion queryDocumentsAcrossHIEs`));
  }
  await findOrCreatePatientMapping({
    cxId,
    patientId: metriportPatient.id,
    externalId: practicefusionPatientId,
    source: EhrSources.practicefusion,
    secondaryMappings: { practiceId: practicefusionPracticeId },
  });
  return metriportPatient.id;
}
