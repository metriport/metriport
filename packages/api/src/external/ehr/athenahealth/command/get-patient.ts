import { PatientResource } from "@metriport/shared/interface/external/athenahealth/patient";
import { normalizeDate, normalizeGender, toTitleCase } from "@metriport/shared";
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { out } from "@metriport/core/util/log";
import { capture } from "@metriport/core/util/notifications";
import { errorToString } from "@metriport/shared";
import { Patient, PatientDemoData } from "@metriport/core/domain/patient";
import { getPatient as getAthenaPatient } from "@metriport/core/external/athenahealth/get-patient";
import { EhrSources } from "../../shared";
import {
  getPatientOrFail as getMetriportPatientOrFail,
  getPatientByDemo as singleGetMetriportPatientByDemo,
} from "../../../../command/medical/patient/get-patient";
import {
  createPatient as createtMetriportPatient,
  PatientCreateCmd,
} from "../../../../command/medical/patient/create-patient";
import { getPatientMapping, findOrCreatePatientMapping } from "../../../../command/mapping/patient";
import { getFacilityMapping } from "../../../../command/mapping/facility";
import { Config } from "../../../../shared/config";
import { createMetriportAddresses, createMetriportContacts } from "../shared";

const athenaUrl = Config.getAthenaHealthUrl();

export async function getPatientIdOrFail({
  accessToken,
  cxId,
  athenaPatientId,
}: {
  accessToken: string;
  cxId: string;
  athenaPatientId: string;
}): Promise<string> {
  const { log } = out(`AthenaHealth getPatient - cxId ${cxId} athenaPatientId ${athenaPatientId}`);
  const existingPatient = await getPatientMapping({
    cxId,
    externalId: athenaPatientId,
    source: EhrSources.ATHENA,
  });
  if (existingPatient) {
    const metriportPatient = await getMetriportPatientOrFail({
      cxId,
      id: existingPatient.patientId,
    });
    return metriportPatient.id;
  }
  if (!athenaUrl) throw new Error("AthenaHealth url not defined");
  const athenaPatient = await getAthenaPatient({
    cxId,
    accessToken,
    baseUrl: athenaUrl,
    patientId: athenaPatientId,
  });
  if (!athenaPatient) throw new Error("AthenaHealth patient not found");
  if (athenaPatient.name.length === 0) {
    throw new Error("AthenaHealth patient missing at least one name");
  }
  if (athenaPatient.address.length === 0) {
    throw new Error("AthenaHealth patient missing at least one address");
  }

  const patientDemoFilters = createMetriportPatientDemoFilters(athenaPatient);
  const patients: Patient[] = [];
  const getPatientByDemoErrors: string[] = [];

  await executeAsynchronously(
    patientDemoFilters.map(demo => {
      return { cxId, demo, patients, errors: getPatientByDemoErrors, log };
    }),
    getPatientByDemo,
    { numberOfParallelExecutions: 5 }
  );

  if (getPatientByDemoErrors.length > 0) {
    capture.error("Failed to get patient by demo", {
      extra: {
        cxId,
        patientDemoFiltersCount: patientDemoFilters.length,
        errorCount: getPatientByDemoErrors.length,
        errors: getPatientByDemoErrors.join(","),
        context: "athenahealth.get-patient",
      },
    });
  }

  let metriportPatient = patients[0];
  if (metriportPatient) {
    const uniquePatientIds = new Set(patients.map(patient => patient.id));
    if (uniquePatientIds.size > 1) {
      capture.message("AthenaHealth patient mapping to more than one Metriport patient", {
        extra: {
          cxId,
          patientDemoFiltersCount: patientDemoFilters.length,
          patientIds: uniquePatientIds,
          context: "athenahealth.get-patient",
        },
        level: "warning",
      });
    }
  } else {
    const defaultFacility = await getFacilityMapping({
      cxId,
      externalId: "default",
      source: EhrSources.ATHENA,
    });
    if (!defaultFacility) {
      throw new Error("Default facility mapping missing for creating new patient");
    }
    metriportPatient = await createtMetriportPatient({
      patient: {
        cxId,
        facilityId: defaultFacility.facilityId,
        ...createMetriportPatientDemo(athenaPatient),
      },
    });
  }
  await findOrCreatePatientMapping({
    cxId,
    patientId: metriportPatient.id,
    externalId: athenaPatientId,
    source: EhrSources.ATHENA,
  });
  return metriportPatient.id;
}

function createMetriportPatientDemoFilters(patient: PatientResource): PatientDemoData[] {
  const patientDemoFilters: PatientDemoData[] = [];
  const addressArray = createMetriportAddresses(patient);
  const contactArray = createMetriportContacts(patient);
  patient.name.map(name => {
    const lastName = name.family;
    if (lastName === "") return;
    name.given.map(firstName => {
      if (firstName === "") return;
      patientDemoFilters.push({
        firstName,
        lastName,
        dob: normalizeDate(patient.birthDate),
        genderAtBirth: normalizeGender(patient.gender),
        address: addressArray,
        contact: contactArray,
      });
    });
  });
  return patientDemoFilters;
}

function createMetriportPatientDemo(
  patient: PatientResource
): Omit<PatientCreateCmd, "cxId" | "facilityId"> {
  const firstNames: string[] = [];
  const lastNames: string[] = [];
  const addressArray = createMetriportAddresses(patient);
  const contactArray = createMetriportContacts(patient);
  patient.name.map(name => {
    const lastName = name.family;
    if (lastName === "") return;
    lastNames.push(toTitleCase(lastName));
    name.given.map(firstName => {
      if (firstName === "") return;
      firstNames.push(toTitleCase(firstName));
    });
  });
  return {
    firstName: firstNames.join(" "),
    lastName: lastNames.join(" "),
    dob: normalizeDate(patient.birthDate),
    genderAtBirth: normalizeGender(patient.gender),
    address: addressArray,
    contact: contactArray,
  };
}

async function getPatientByDemo({
  cxId,
  demo,
  patients,
  errors,
  log,
}: {
  cxId: string;
  demo: PatientDemoData;
  patients: Patient[];
  errors: string[];
  log: typeof console.log;
}): Promise<void> {
  try {
    const patient = await singleGetMetriportPatientByDemo({ cxId, demo });
    if (patient) patients.push(patient);
  } catch (error) {
    const msg = `Failed to get patient by demo. Cause: ${errorToString(error)}`;
    log(msg);
    errors.push(msg);
  }
}
