import { Patient, PatientDemoData } from "@metriport/core/domain/patient";
import AthenaHealthApi from "@metriport/core/external/athenahealth/index";
import { executeAsynchronously } from "@metriport/core/util/concurrency";
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
import { PatientResource } from "@metriport/shared/interface/external/athenahealth/patient";
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
import { EhrSources } from "../../shared";
import {
  createAthenaClient,
  createMetriportAddresses,
  createMetriportContacts,
  createNames,
} from "../shared";

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
  const { log } = out(
    `AthenaHealth syncAthenaPatientIntoMetriport - cxId ${cxId} athenaPracticeId ${athenaPracticeId} athenaPatientId ${athenaPatientId}`
  );
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
    return metriportPatient.id;
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
  if (!athenaPatient) throw new NotFoundError("AthenaHealth patient not found");
  if (athenaPatient.name.length === 0) {
    throw new MetriportError("AthenaHealth patient missing at least one name", undefined, {
      name: athenaPatient.name.map(name => JSON.stringify(name)).join(", "),
    });
  }
  if (athenaPatient.address.length === 0) {
    throw new MetriportError("AthenaHealth patient missing at least one address", undefined, {
      address: athenaPatient.address.map(address => JSON.stringify(address)).join(", "),
    });
  }

  const demos = createMetriportPatientDemos(athenaPatient);

  const patients: Patient[] = [];
  const getPatientByDemoErrors: unknown[] = [];
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
        log(`Failed to get patient by demo. Cause: ${errorToString(error)}`);
        getPatientByDemoErrors.push(error);
      }
    },
    { numberOfParallelExecutions: parallelPatientMatches }
  );

  if (getPatientByDemoErrors.length > 0) {
    capture.error("Failed to get patient by demos", {
      extra: {
        cxId,
        athenaPracticeId,
        athenaPatientId,
        getPatientByDemoArgsCount: getPatientByDemoArgs.length,
        errorCount: getPatientByDemoErrors.length,
        errors: getPatientByDemoErrors.map(e => `Cause: ${errorToString(e)}`).join(","),
        context: "athenahealth.sync-patient",
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
        ...createMetriportPatientCreateCmd(athenaPatient),
        externalId: athenaApi.stripPatientId(athenaPatientId),
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

function createMetriportPatientDemos(patient: PatientResource): PatientDemoData[] {
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

function createMetriportPatientCreateCmd(
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
