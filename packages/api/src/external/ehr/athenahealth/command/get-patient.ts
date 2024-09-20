import { PatientResource } from "@metriport/shared/interface/external/athenahealth/patient";
import {
  errorToString,
  normalizeDate,
  normalizeGender,
  toTitleCase,
  NotFoundError,
} from "@metriport/shared";
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { getSecretValueOrFail } from "@metriport/core/external/aws/secret-manager";
import { out } from "@metriport/core/util/log";
import { capture } from "@metriport/core/util/notifications";
import { Patient, PatientDemoData } from "@metriport/core/domain/patient";
import AthenaHealthApi, { AthenaEnv } from "@metriport/core/external/athenahealth/index";
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
import { getFacilityMappingOrFail } from "../../../../command/mapping/facility";
import { Config } from "../../../../shared/config";
import { createMetriportAddresses, createMetriportContacts, createNames } from "../shared";

const region = Config.getAWSRegion();
const athenaEnvironment = Config.getAthenaHealthEnv();
const athenaClientKeySecretArn = Config.getAthenaHealthClientKeyArm();
const athenaClientSecretSecretArn = Config.getAthenaHealthClientSecretArn();
const defaultFacilityMappingExternalId = "default";

export async function getPatientIdOrFail({
  accessToken,
  cxId,
  athenaPracticeId,
  athenaPatientId,
}: {
  accessToken: string;
  cxId: string;
  athenaPracticeId: string;
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
  if (!athenaEnvironment || !athenaClientKeySecretArn || !athenaClientSecretSecretArn) {
    throw new Error("AthenaHealth not setup");
  }
  const athenaClientKey = await getSecretValueOrFail(athenaClientKeySecretArn, region);
  const athenaClientSecret = await getSecretValueOrFail(athenaClientSecretSecretArn, region);
  const api = await AthenaHealthApi.create({
    threeLeggedAuthToken: accessToken,
    practiceId: athenaPracticeId,
    environment: athenaEnvironment as AthenaEnv,
    clientKey: athenaClientKey,
    clientSecret: athenaClientSecret,
  });
  const athenaPatient = await api.getPatient({
    cxId,
    patientId: athenaPatientId,
  });
  if (!athenaPatient) throw new NotFoundError("AthenaHealth patient not found");
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
    const defaultFacility = await getFacilityMappingOrFail({
      cxId,
      externalId: defaultFacilityMappingExternalId,
      source: EhrSources.ATHENA,
    });
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
  const addressArray = createMetriportAddresses(patient);
  const contactArray = createMetriportContacts(patient);
  const names = createNames(patient);
  return names.map(n => {
    return {
      firstName: n.firstName,
      lastName: n.lastName,
      dob: normalizeDate(patient.birthDate),
      genderAtBirth: normalizeGender(patient.gender),
      address: addressArray,
      contact: contactArray,
    };
  });
}

function createMetriportPatientDemo(
  patient: PatientResource
): Omit<PatientCreateCmd, "cxId" | "facilityId"> {
  const addressArray = createMetriportAddresses(patient);
  const contactArray = createMetriportContacts(patient);
  const names = createNames(patient);
  return {
    firstName: [...new Set(names.map(n => toTitleCase(n.firstName)))].join(" "),
    lastName: [...new Set(names.map(n => toTitleCase(n.lastName)))].join(" "),
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
