import AthenaHealthApi from "@metriport/core/external/ehr/athenahealth";
import { isAthenaCustomFieldsEnabledForCx } from "@metriport/core/external/aws/app-config";
import { EhrSources } from "@metriport/shared/src/interface/external/ehr/source";
import { processAsyncError } from "@metriport/core/util/error/shared";
import { BadRequestError } from "@metriport/shared";
import { findOrCreatePatientMapping, getPatientMapping } from "../../../../command/mapping/patient";
import { queryDocumentsAcrossHIEs } from "../../../../command/medical/document/document-query";
import { getPatientOrFail } from "../../../../command/medical/patient/get-patient";
import { Config } from "../../../../shared/config";
import {
  createMetriportPatientDemosFhir,
  getOrCreateMetriportPatientFhir,
} from "../../shared-fhir";
import { createAthenaClient } from "../shared";

const CUSTOM_FIELD_ID_OPT_IN = Config.isProdEnv() ? "121" : "1269";
const CUSTOM_FIELD_ID_OPT_OUT = Config.isProdEnv() ? "101" : "1289";

export type SyncAthenaPatientIntoMetriportParams = {
  cxId: string;
  athenaPracticeId: string;
  athenaPatientId: string;
  api?: AthenaHealthApi;
  triggerDq?: boolean;
};

export async function syncAthenaPatientIntoMetriport({
  cxId,
  athenaPracticeId,
  athenaPatientId,
  api,
  triggerDq = false,
}: SyncAthenaPatientIntoMetriportParams): Promise<string> {
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
    const metriportPatientId = metriportPatient.id;
    return metriportPatientId;
  }

  const athenaApi = api ?? (await createAthenaClient({ cxId, practiceId: athenaPracticeId }));
  if (await isAthenaCustomFieldsEnabledForCx(cxId)) {
    const customFields = await athenaApi.getCustomFieldsForPatient({
      cxId,
      patientId: athenaPatientId,
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
  const athenaPatient = await athenaApi.searchPatient({ cxId, patientId: athenaPatientId });
  const possibleDemographics = createMetriportPatientDemosFhir(athenaPatient);
  const metriportPatient = await getOrCreateMetriportPatientFhir({
    cxId,
    source: EhrSources.athena,
    practiceId: athenaPracticeId,
    possibleDemographics,
    externalId: athenaApi.stripPatientId(athenaPatientId),
  });
  if (triggerDq) {
    queryDocumentsAcrossHIEs({
      cxId,
      patientId: metriportPatient.id,
    }).catch(processAsyncError(`AthenaHealth queryDocumentsAcrossHIEs`));
  }
  await findOrCreatePatientMapping({
    cxId,
    patientId: metriportPatient.id,
    externalId: athenaPatientId,
    source: EhrSources.athena,
  });
  return metriportPatient.id;
}
