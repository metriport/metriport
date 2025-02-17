import { Patient, PatientDemoData } from "@metriport/core/domain/patient";
import AthenaHealthApi from "@metriport/core/external/athenahealth/index";
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { processAsyncError } from "@metriport/core/util/error/shared";
import { capture } from "@metriport/core/util/notifications";
import { MetriportError, normalizeDob, normalizeGender } from "@metriport/shared";
import { Patient as AthenaPatient } from "@metriport/shared/interface/external/athenahealth/patient";
import { getFacilityMappingOrFail } from "../../../../command/mapping/facility";
import { findOrCreatePatientMapping, getPatientMapping } from "../../../../command/mapping/patient";
import { queryDocumentsAcrossHIEs } from "../../../../command/medical/document/document-query";
import { createPatient as createMetriportPatient } from "../../../../command/medical/patient/create-patient";
import {
  getPatientByDemo,
  getPatientOrFail,
} from "../../../../command/medical/patient/get-patient";
import { EhrSources } from "../../shared";
import { createAddresses, createAthenaClient, createContacts, createNames } from "../shared";

const parallelPatientMatches = 5;

type GetPatientByDemoParams = {
  cxId: string;
  demo: PatientDemoData;
};

export async function syncAthenaPatientIntoMetriport({
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
    if (triggerDq) {
      queryDocumentsAcrossHIEs({
        cxId,
        patientId: metriportPatientId,
      }).catch(processAsyncError("AthenaHealth queryDocumentsAcrossHIEs"));
    }
    return metriportPatientId;
  }

  const athenaApi =
    api ??
    (await createAthenaClient({
      cxId,
      practiceId: athenaPracticeId,
      threeLeggedAuthToken: accessToken,
    }));
  const athenaPatient = await getPatientFromAthena({
    api: athenaApi,
    cxId,
    patientId: athenaPatientId,
    useSearch,
  });

  const demos = createMetriportPatientDemos(athenaPatient);

  const patients: Patient[] = [];
  const getPatientByDemoErrors: { error: unknown; cxId: string; demos: string }[] = [];
  const getPatientByDemoArgs: GetPatientByDemoParams[] = demos.map(demo => {
    return { cxId, demo };
  });

  await executeAsynchronously(
    getPatientByDemoArgs,
    async (params: GetPatientByDemoParams) => {
      try {
        const patient = await getPatientByDemo(params);
        if (patient) patients.push(patient);
      } catch (error) {
        getPatientByDemoErrors.push({ error, ...params, demos: JSON.stringify(params.demo) });
      }
    },
    { numberOfParallelExecutions: parallelPatientMatches }
  );

  if (getPatientByDemoErrors.length > 0) {
    const msg = "Failed to get patient by some demos @ AthenaHealth";
    capture.message(msg, {
      extra: {
        cxId,
        athenaPracticeId,
        athenaPatientId,
        getPatientByDemoArgsCount: getPatientByDemoArgs.length,
        errorCount: getPatientByDemoErrors.length,
        errors: getPatientByDemoErrors,
        context: "athenahealth.sync-patient",
      },
      level: "warning",
    });
  }

  let metriportPatient = patients[0];
  if (metriportPatient) {
    const uniquePatientIds = new Set(patients.map(patient => patient.id));
    if (uniquePatientIds.size > 1) {
      capture.message("AthenaHealth patient mapping to more than one Metriport patient", {
        extra: {
          cxId,
          patientIds: uniquePatientIds,
          context: "athenahealth.sync-patient",
        },
        level: "warning",
      });
    }
  } else {
    const defaultFacility = await getFacilityMappingOrFail({
      cxId,
      externalId: athenaPracticeId,
      source: EhrSources.athena,
    });
    metriportPatient = await createMetriportPatient({
      patient: {
        cxId,
        facilityId: defaultFacility.facilityId,
        externalId: athenaApi.stripPatientId(athenaPatientId),
        ...collapsePatientDemos(demos),
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

function createMetriportPatientDemos(patient: AthenaPatient): PatientDemoData[] {
  const dob = normalizeDob(patient.birthDate);
  const genderAtBirth = normalizeGender(patient.gender);
  const addressArray = createAddresses(patient);
  const contactArray = createContacts(patient);
  const namesArray = createNames(patient);
  return namesArray.map(n => {
    return {
      firstName: n.firstName,
      lastName: n.lastName,
      dob,
      genderAtBirth,
      address: addressArray,
      contact: contactArray,
    };
  });
}

function collapsePatientDemos(demos: PatientDemoData[]): PatientDemoData {
  const firstDemo = demos[0];
  if (!firstDemo) throw new MetriportError("No patient demos to collapse");
  return demos.slice(1).reduce((acc: PatientDemoData, demo) => {
    return {
      ...acc,
      firstName: acc.firstName.includes(demo.firstName)
        ? acc.firstName
        : `${acc.firstName} ${demo.firstName}`,
      lastName: acc.lastName.includes(demo.lastName)
        ? acc.lastName
        : `${acc.lastName} ${demo.lastName}`,
    };
  }, firstDemo);
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
}): Promise<AthenaPatient> {
  if (useSearch) {
    return await api.searchPatient({
      cxId,
      patientId,
    });
  }
  return await api.getPatient({
    cxId,
    patientId,
  });
}
