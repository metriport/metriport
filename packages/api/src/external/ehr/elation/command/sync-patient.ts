import { PatientDemoData } from "@metriport/core/domain/patient";
import ElationApi from "@metriport/core/external/elation/index";
import { processAsyncError } from "@metriport/core/util/error/shared";
import { normalizeDob, normalizeGender } from "@metriport/shared";
import { Patient as ElationPatient } from "@metriport/shared/interface/external/elation/patient";
import { findOrCreatePatientMapping, getPatientMapping } from "../../../../command/mapping/patient";
import { queryDocumentsAcrossHIEs } from "../../../../command/medical/document/document-query";
import {
  getPatientByDemo,
  getPatientOrFail,
  PatientWithIdentifiers,
} from "../../../../command/medical/patient/get-patient";
import { Config } from "../../../../shared/config";
import { handleMetriportSync, HandleMetriportSyncParams } from "../../patient";
import { EhrSources } from "../../shared";
import { createAddresses, createContacts, createElationClient, createNames } from "../shared";

export type SyncElationPatientIntoMetriportParams = {
  cxId: string;
  elationPracticeId: string;
  elationPatientId: string;
  api?: ElationApi;
  triggerDq?: boolean;
};

export async function syncElationPatientIntoMetriport({
  cxId,
  elationPracticeId,
  elationPatientId,
  api,
  triggerDq = false,
}: SyncElationPatientIntoMetriportParams): Promise<string> {
  const existingPatient = await getPatientMapping({
    cxId,
    externalId: elationPatientId,
    source: EhrSources.elation,
  });
  if (existingPatient) {
    const metriportPatient = await getPatientOrFail({
      cxId,
      id: existingPatient.patientId,
    });
    const metriportPatientId = metriportPatient.id;
    return metriportPatientId;
  }

  const elationApi = api ?? (await createElationClient({ cxId, practiceId: elationPracticeId }));
  const elationPatient = await elationApi.getPatient({ cxId, patientId: elationPatientId });
  const demographics = createMetriportPatientDemographics(elationPatient);
  const metriportPatient = await getOrCreateMetriportPatient({
    cxId,
    practiceId: elationPracticeId,
    demographics,
    externalId: elationPatientId,
  });
  if (triggerDq) {
    queryDocumentsAcrossHIEs({
      cxId,
      patientId: metriportPatient.id,
    }).catch(processAsyncError(`Elation queryDocumentsAcrossHIEs`));
  }
  const dashUrl = Config.getDashUrl();
  await Promise.all([
    findOrCreatePatientMapping({
      cxId,
      patientId: metriportPatient.id,
      externalId: elationPatientId,
      source: EhrSources.elation,
    }),
    dashUrl &&
      elationApi.updatePatientMetadata({
        cxId,
        patientId: elationPatientId,
        metadata: {
          object_id: metriportPatient.id,
          object_web_link: `${dashUrl}/patient/${metriportPatient.id}`,
        },
      }),
  ]);
  return metriportPatient.id;
}

function createMetriportPatientDemographics(patient: ElationPatient): PatientDemoData {
  const dob = normalizeDob(patient.dob);
  const genderAtBirth = normalizeGender(patient.sex);
  const addressArray = createAddresses(patient);
  const contactArray = createContacts(patient);
  const names = createNames(patient);
  return {
    ...names,
    dob,
    genderAtBirth,
    address: addressArray,
    contact: contactArray,
  };
}

async function getOrCreateMetriportPatient({
  cxId,
  practiceId,
  demographics,
  externalId,
}: Omit<HandleMetriportSyncParams, "source">): Promise<PatientWithIdentifiers> {
  const metriportPatient = await getPatientByDemo({ cxId, demo: demographics });
  if (metriportPatient) return metriportPatient;
  return await handleMetriportSync({
    cxId,
    source: EhrSources.elation,
    practiceId,
    demographics,
    externalId,
  });
}
