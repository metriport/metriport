import { PatientResource } from "@metriport/shared/interface/external/athenahealth/patient";
import {
  errorToString,
  normalizeDate,
  normalizeGender,
  toTitleCase,
  NotFoundError,
} from "@metriport/shared";
import { processAsyncError } from "@metriport/core/util/error/shared";
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
  createPatient as createMetriportPatient,
  PatientCreateCmd,
} from "../../../../command/medical/patient/create-patient";
import { queryDocumentsAcrossHIEs } from "../../../../command/medical/document/document-query";
import { getPatientMapping, findOrCreatePatientMapping } from "../../../../command/mapping/patient";
import { getFacilityMappingOrFail } from "../../../../command/mapping/facility";
import { Config } from "../../../../shared/config";
import { createMetriportAddresses, createMetriportContacts, createNames } from "../shared";

const region = Config.getAWSRegion();
const athenaEnvironment = Config.getAthenaHealthEnv();
const athenaClientKeySecretArn = Config.getAthenaHealthClientKeyArn();
const athenaClientSecretSecretArn = Config.getAthenaHealthClientSecretArn();
const defaultFacilityMappingExternalId = "default";

const parallelPatientMatches = 5;

export async function getPatientIdOrFail({
  cxId,
  athenaPracticeId,
  athenaPatientId,
  accessToken,
  api,
  useSearch = false,
  triggerDq = false,
}: {
  cxId: string;
  athenaPracticeId: string;
  athenaPatientId: string;
  accessToken?: string;
  api?: AthenaHealthApi;
  useSearch?: boolean;
  triggerDq?: boolean;
}): Promise<string> {
  const { log } = out(
    `AthenaHealth getPatientIdOrFail - cxId ${cxId} athenaPracticeId ${athenaPracticeId} athenaPatientId ${athenaPatientId}`
  );
  const existingPatient = await getPatientMapping({
    cxId,
    externalId: athenaPatientId,
    source: EhrSources.athena,
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

  let athenaApi = api;
  if (!athenaApi) {
    const athenaClientKey = await getSecretValueOrFail(athenaClientKeySecretArn, region);
    const athenaClientSecret = await getSecretValueOrFail(athenaClientSecretSecretArn, region);
    athenaApi = await AthenaHealthApi.create({
      threeLeggedAuthToken: accessToken,
      practiceId: athenaPracticeId,
      environment: athenaEnvironment as AthenaEnv,
      clientKey: athenaClientKey,
      clientSecret: athenaClientSecret,
    });
  }
  const athenaPatient = await getPatientFromAthena({
    api: athenaApi,
    cxId,
    patientId: athenaPatientId,
    useSearch,
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
  const getPatientByDemoArgs = patientDemoFilters.map(demo => {
    return {
      cxId,
      athenaPracticeId,
      athenaPatientId,
      demo,
      patients,
      errors: getPatientByDemoErrors,
      log,
    };
  });

  await executeAsynchronously(getPatientByDemoArgs, getPatientByDemo, {
    numberOfParallelExecutions: parallelPatientMatches,
  });

  if (getPatientByDemoErrors.length > 0) {
    capture.error("Failed to get patient by demo", {
      extra: {
        cxId,
        getPatientByDemoArgsCount: getPatientByDemoArgs.length,
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
      source: EhrSources.athena,
    });
    metriportPatient = await createMetriportPatient({
      patient: {
        cxId,
        facilityId: defaultFacility.facilityId,
        ...createMetriportPatientDemo(athenaPatient),
      },
    });
    if (triggerDq) {
      queryDocumentsAcrossHIEs({
        cxId,
        patientId: metriportPatient.id,
      }).catch(processAsyncError("AthenaHealth queryDocumentsAcrossHIEs"));
    }
  }
  await findOrCreatePatientMapping({
    cxId,
    patientId: metriportPatient.id,
    externalId: athenaPatientId,
    source: EhrSources.athena,
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
  athenaPracticeId,
  athenaPatientId,
  demo,
  patients,
  errors,
  log,
}: {
  cxId: string;
  athenaPracticeId: string;
  athenaPatientId: string;
  demo: PatientDemoData;
  patients: Patient[];
  errors: string[];
  log: typeof console.log;
}): Promise<void> {
  try {
    const patient = await singleGetMetriportPatientByDemo({ cxId, demo });
    if (patient) patients.push(patient);
  } catch (error) {
    const msg = `Failed to get patient by demo. cxId ${cxId} athenaPracticeId ${athenaPracticeId} athenaPatientId ${athenaPatientId}. Cause: ${errorToString(
      error
    )}`;
    log(msg);
    errors.push(msg);
  }
}

async function getPatientFromAthena({
  api,
  cxId,
  patientId,
  useSearch,
}: {
  api: AthenaHealthApi;
  cxId: string;
  patientId: string;
  useSearch: boolean;
}) {
  if (useSearch) {
    return await api.getPatientViaSearch({
      cxId,
      patientId,
    });
  }
  return await api.getPatient({
    cxId,
    patientId,
  });
}
