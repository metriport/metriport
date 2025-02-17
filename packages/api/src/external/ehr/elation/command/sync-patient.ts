import { PatientDemoData } from "@metriport/core/domain/patient";
import ElationApi from "@metriport/core/external/elation/index";
import { processAsyncError } from "@metriport/core/util/error/shared";
import { normalizeDob, normalizeGender } from "@metriport/shared";
import { Patient as ElationPatient } from "@metriport/shared/interface/external/elation/patient";
import { getFacilityMappingOrFail } from "../../../../command/mapping/facility";
import { findOrCreatePatientMapping, getPatientMapping } from "../../../../command/mapping/patient";
import { queryDocumentsAcrossHIEs } from "../../../../command/medical/document/document-query";
import { createPatient as createMetriportPatient } from "../../../../command/medical/patient/create-patient";
import {
  getPatientByDemo,
  getPatientOrFail,
} from "../../../../command/medical/patient/get-patient";
import { Config } from "../../../../shared/config";
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
    if (triggerDq) {
      queryDocumentsAcrossHIEs({
        cxId,
        patientId: metriportPatient.id,
      }).catch(processAsyncError("Elation queryDocumentsAcrossHIEs"));
    }
    return metriportPatientId;
  }

  const elationApi = api ?? (await createElationClient({ cxId, practiceId: elationPracticeId }));
  const elationPatient = await elationApi.getPatient({ cxId, patientId: elationPatientId });

  const demo = createMetriportPatientDemo(elationPatient);

  let metriportPatient = await getPatientByDemo({ cxId, demo });
  if (!metriportPatient) {
    const defaultFacility = await getFacilityMappingOrFail({
      cxId,
      externalId: elationPracticeId,
      source: EhrSources.elation,
    });
    metriportPatient = await createMetriportPatient({
      patient: {
        cxId,
        facilityId: defaultFacility.facilityId,
        externalId: elationPatientId,
        ...demo,
      },
    });
    if (triggerDq) {
      queryDocumentsAcrossHIEs({
        cxId,
        patientId: metriportPatient.id,
      }).catch(processAsyncError("Elation queryDocumentsAcrossHIEs"));
    }
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

function createMetriportPatientDemo(patient: ElationPatient): PatientDemoData {
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
