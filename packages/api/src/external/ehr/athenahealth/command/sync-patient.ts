import { isAthenaCustomFieldsEnabledForCx } from "@metriport/core/command/feature-flags/domain-ffs";
import AthenaHealthApi from "@metriport/core/external/ehr/athenahealth/index";
import { BadRequestError } from "@metriport/shared";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { Config } from "../../../../shared/config";
import { SyncPatientParamsWithPracticeId } from "../../shared/command/sync/sync-patient";
import {
  createMetriportPatientDemosFhir,
  getOrCreateMetriportPatientFhir,
} from "../../shared/utils/fhir";
import { createAthenaClient } from "../shared";

const CUSTOM_FIELD_ID_OPT_IN = Config.isProdEnv() ? "121" : "1269";
const CUSTOM_FIELD_ID_OPT_OUT = Config.isProdEnv() ? "101" : "1289";

export async function syncAthenaPatientIntoMetriport({
  cxId,
  practiceId,
  ehrPatientId,
  departmentId,
}: SyncPatientParamsWithPracticeId): Promise<string> {
  if (!departmentId) {
    throw new BadRequestError("Department ID is required for AthenaHealth");
  }
  let athenaApi: AthenaHealthApi | undefined;
  if (await isAthenaCustomFieldsEnabledForCx(cxId)) {
    athenaApi = await createAthenaClient({ cxId, practiceId });
    const customFields = await athenaApi.getCustomFieldsForPatient({
      cxId,
      patientId: ehrPatientId,
      departmentId,
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
  athenaApi = await createAthenaClient({ cxId, practiceId });
  const athenaPatient = await athenaApi.searchPatient({ cxId, patientId: ehrPatientId });
  const possibleDemographics = createMetriportPatientDemosFhir(athenaPatient);
  const metriportPatient = await getOrCreateMetriportPatientFhir({
    cxId,
    source: EhrSources.athena,
    practiceId: practiceId,
    possibleDemographics,
    externalId: athenaApi.stripPatientId(ehrPatientId),
  });
  return metriportPatient.id;
}
