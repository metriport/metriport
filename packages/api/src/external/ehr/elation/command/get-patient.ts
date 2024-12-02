import { Patient, PatientDemoData } from "@metriport/core/domain/patient";
import ElationApi, { ElationEnv } from "@metriport/core/external/elation/index";
import { processAsyncError } from "@metriport/core/util/error/shared";
import { out } from "@metriport/core/util/log";
import { capture } from "@metriport/core/util/notifications";
import {
  errorToString,
  MetriportError,
  normalizeDate,
  normalizeGender,
  NotFoundError,
  toTitleCase,
} from "@metriport/shared";
import { PatientResource } from "@metriport/shared/interface/external/elation/patient";
import { getFacilityMappingOrFail } from "../../../../command/mapping/facility";
import { findOrCreatePatientMapping, getPatientMapping } from "../../../../command/mapping/patient";
import { queryDocumentsAcrossHIEs } from "../../../../command/medical/document/document-query";
import {
  createPatient as createMetriportPatient,
  PatientCreateCmd,
} from "../../../../command/medical/patient/create-patient";
import {
  getPatientOrFail as getMetriportPatientOrFail,
  getPatientByDemo as singleGetMetriportPatientByDemo,
} from "../../../../command/medical/patient/get-patient";
import { Config } from "../../../../shared/config";
import { EhrSources } from "../../shared";
import {
  createMetriportAddresses,
  createMetriportContacts,
  createNames,
  getElationClientKeyAndSecret,
} from "../shared";

const elationEnvironment = Config.getElationEnv();

export async function getPatientIdOrFail({
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
  const { log } = out(
    `Elation getPatientIdOrFail - cxId ${cxId} elationPracticeId ${elationPracticeId} elationPatientId ${elationPatientId}`
  );
  const existingPatient = await getPatientMapping({
    cxId,
    externalId: elationPatientId,
    source: EhrSources.elation,
  });
  if (existingPatient) {
    const metriportPatient = await getMetriportPatientOrFail({
      cxId,
      id: existingPatient.patientId,
    });
    return metriportPatient.id;
  }
  if (!elationEnvironment) throw new MetriportError("Elation not setup");

  let elationApi = api;
  if (!elationApi) {
    const { clientKey, clientSecret } = await getElationClientKeyAndSecret({
      cxId,
      practiceId: elationPracticeId,
    });
    elationApi = await ElationApi.create({
      practiceId: elationPracticeId,
      environment: elationEnvironment as ElationEnv,
      clientKey,
      clientSecret,
    });
  }
  const elationPatient = await elationApi.getPatient({
    cxId,
    patientId: elationPatientId,
  });
  if (!elationPatient) throw new NotFoundError("Elation patient not found");
  if (elationPatient.first_name === "" || elationPatient.last_name === "") {
    throw new MetriportError("Elation patient has empty first or last name", undefined, {
      firstName: elationPatient.first_name,
      lastName: elationPatient.last_name,
    });
  }
  if (elationPatient.address.address_line1 === "") {
    throw new MetriportError("Elation patient has empty address line 1", undefined, {
      addressLine1: elationPatient.address.address_line1,
    });
  }

  const patientDemoFilters = createMetriportPatientDemoFilters(elationPatient);
  const patient = await getPatientByDemo({
    cxId,
    elationPracticeId,
    elationPatientId,
    demo: patientDemoFilters,
    log,
  });

  let metriportPatient = patient;
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
        ...createMetriportPatientDemo(elationPatient),
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
          object_web_link: `${dashUrl}/patients/${metriportPatient.id}`,
        },
      }),
  ]);
  return metriportPatient.id;
}

function createMetriportPatientDemoFilters(patient: PatientResource): PatientDemoData {
  const addressArray = createMetriportAddresses(patient);
  const contactArray = createMetriportContacts(patient);
  const names = createNames(patient);
  return {
    ...names,
    dob: normalizeDate(patient.dob),
    genderAtBirth: normalizeGender(patient.sex),
    address: addressArray,
    contact: contactArray,
  };
}

function createMetriportPatientDemo(
  patient: PatientResource
): Omit<PatientCreateCmd, "cxId" | "facilityId"> {
  const addressArray = createMetriportAddresses(patient);
  const contactArray = createMetriportContacts(patient);
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

async function getPatientByDemo({
  cxId,
  elationPracticeId,
  elationPatientId,
  demo,
  log,
}: {
  cxId: string;
  elationPracticeId: string;
  elationPatientId: string;
  demo: PatientDemoData;
  log: typeof console.log;
}): Promise<Patient | undefined> {
  try {
    return await singleGetMetriportPatientByDemo({ cxId, demo });
  } catch (error) {
    const msg = "Failed to get patient by demo.";
    log(`${msg}. Cause: ${errorToString(error)}`);
    capture.error(msg, {
      extra: {
        cxId,
        elationPracticeId,
        elationPatientId,
        context: "elation.get-patient",
      },
    });
  }
}
