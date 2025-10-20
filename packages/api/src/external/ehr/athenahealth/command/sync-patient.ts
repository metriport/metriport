import { isAthenaCustomFieldsEnabledForCx } from "@metriport/core/command/feature-flags/domain-ffs";
import AthenaHealthApi from "@metriport/core/external/ehr/athenahealth/index";
import { processAsyncError } from "@metriport/core/util/error/shared";
import { BadRequestError } from "@metriport/shared";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { findOrCreatePatientMapping, getPatientMapping } from "../../../../command/mapping/patient";
import { queryDocumentsAcrossHIEs } from "../../../../command/medical/document/document-query";
import { getPatientOrFail } from "../../../../command/medical/patient/get-patient";
import { getPatientPrimaryFacilityIdOrFail } from "../../../../command/medical/patient/get-patient-facilities";
import { Config } from "../../../../shared/config";
import { getOrCreateMetriportPatientFhir } from "../../shared/command/patient/get-or-create-metriport-patient-fhir";
import { createMetriportPatientDemosFhir } from "../../shared/utils/fhir";
import { isDqCooldownExpired } from "../../shared/utils/patient";
import { createAthenaClient, validateDepartmentId } from "../shared";

const CUSTOM_FIELD_ID_OPT_IN = Config.isProdEnv() ? "121" : "1269";
const CUSTOM_FIELD_ID_OPT_OUT = Config.isProdEnv() ? "101" : "1289";

export type SyncAthenaPatientIntoMetriportParams = {
  cxId: string;
  athenaPracticeId: string;
  athenaPatientId: string;
  athenaDepartmentId: string;
  api?: AthenaHealthApi;
  triggerDq?: boolean;
  triggerDqForExistingPatient?: boolean;
};

export async function syncAthenaPatientIntoMetriport({
  cxId,
  athenaPracticeId,
  athenaPatientId,
  athenaDepartmentId,
  api,
  triggerDq = false,
  triggerDqForExistingPatient = false,
}: SyncAthenaPatientIntoMetriportParams): Promise<string> {
  await validateDepartmentId({ cxId, athenaPracticeId, athenaPatientId, athenaDepartmentId });
  let athenaApi: AthenaHealthApi | undefined;
  if (await isAthenaCustomFieldsEnabledForCx(cxId)) {
    athenaApi = api ?? (await createAthenaClient({ cxId, practiceId: athenaPracticeId }));
    const customFields = await athenaApi.getCustomFieldsForPatient({
      cxId,
      patientId: athenaPatientId,
      departmentId: athenaDepartmentId,
    });
    const targetFieldOptIn = customFields.find(
      field => field.customfieldid === CUSTOM_FIELD_ID_OPT_IN
    );
    const targetFieldOptOut = customFields.find(
      field => field.customfieldid === CUSTOM_FIELD_ID_OPT_OUT
    );
    const optedIn =
      !targetFieldOptOut && targetFieldOptIn && targetFieldOptIn.customfieldvalue === "Y";
    if (!optedIn) throw new BadRequestError("AthenaHealth patient opted out of data sharing");
  }

  const existingPatient = await getPatientMapping({
    cxId,
    externalId: athenaPatientId,
    source: EhrSources.athena,
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
      }).catch(processAsyncError(`AthenaHealth queryDocumentsAcrossHIEs`));
    }
    const metriportPatientId = metriportPatient.id;
    return metriportPatientId;
  }
  if (!athenaApi) {
    athenaApi = api ?? (await createAthenaClient({ cxId, practiceId: athenaPracticeId }));
  }
  const athenaPatient = await athenaApi.searchPatient({ cxId, patientId: athenaPatientId });
  const possibleDemographics = createMetriportPatientDemosFhir(athenaPatient);
  const metriportPatient = await getOrCreateMetriportPatientFhir({
    cxId,
    source: EhrSources.athena,
    practiceId: athenaPracticeId,
    possibleDemographics,
    externalId: athenaApi.stripPatientId(athenaPatientId),
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
    }).catch(processAsyncError(`AthenaHealth queryDocumentsAcrossHIEs`));
  }
  await findOrCreatePatientMapping({
    cxId,
    patientId: metriportPatient.id,
    externalId: athenaPatientId,
    source: EhrSources.athena,
    secondaryMappings: { practiceId: athenaPracticeId },
  });
  return metriportPatient.id;
}
