import { PatientDemoData } from "@metriport/core/domain/patient";
import ElationApi from "@metriport/core/external/elation/index";
import { processAsyncError } from "@metriport/core/util/error/shared";
import { normalizeDate, normalizeGender, NotFoundError, toTitleCase } from "@metriport/shared";
import { PatientResource } from "@metriport/shared/interface/external/elation/patient";
import { getFacilityMappingOrFail } from "../../../../command/mapping/facility";
import { findOrCreatePatientMapping, getPatientMapping } from "../../../../command/mapping/patient";
import { queryDocumentsAcrossHIEs } from "../../../../command/medical/document/document-query";
import {
  createPatient as createMetriportPatient,
  PatientCreateCmd,
} from "../../../../command/medical/patient/create-patient";
import {
  getPatientByDemo,
  getPatientOrFail,
} from "../../../../command/medical/patient/get-patient";
import { Config } from "../../../../shared/config";
import { EhrSources } from "../../shared";
import {
  createAddresses,
  createContacts,
  createNames,
  getElationClientKeyAndSecret,
  getElationEnv,
} from "../shared";

export async function syncElationPatientIntoMetriport({
  cxId,
  elationPracticeId,
  elationPatientId,
  api,
  triggerDq = false,
}: {
  cxId: string;
  elationPracticeId: string;
  elationPatientId: string;
  api?: ElationApi;
  triggerDq?: boolean;
}): Promise<string> {
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
    return metriportPatient.id;
  }
  let elationApi = api;
  if (!elationApi) {
    const environment = getElationEnv();
    const { clientKey, clientSecret } = await getElationClientKeyAndSecret({
      cxId,
      practiceId: elationPracticeId,
    });
    elationApi = await ElationApi.create({
      practiceId: elationPracticeId,
      environment,
      clientKey,
      clientSecret,
    });
  }
  const elationPatient = await elationApi.getPatient({
    cxId,
    patientId: elationPatientId,
  });
  if (!elationPatient) throw new NotFoundError("Patient not found");

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
        ...createMetriportPatientCreateCmd(elationPatient),
        externalId: elationPatientId,
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

function createMetriportPatientDemo(patient: PatientResource): PatientDemoData {
  const addressArray = createAddresses(patient);
  const contactArray = createContacts(patient);
  const names = createNames(patient);
  return {
    ...names,
    dob: normalizeDate(patient.dob),
    genderAtBirth: normalizeGender(patient.sex),
    address: addressArray,
    contact: contactArray,
  };
}

function createMetriportPatientCreateCmd(
  patient: PatientResource
): Omit<PatientCreateCmd, "cxId" | "facilityId"> {
  const addressArray = createAddresses(patient);
  const contactArray = createContacts(patient);
  const names = createNames(patient);
  return {
    firstName: toTitleCase(names.firstName),
    lastName: toTitleCase(names.lastName),
    dob: normalizeDate(patient.dob),
    genderAtBirth: normalizeGender(patient.sex),
    address: addressArray,
    contact: contactArray,
  };
}
