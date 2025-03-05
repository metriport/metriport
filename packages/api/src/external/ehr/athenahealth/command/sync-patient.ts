import { Patient, PatientDemoData } from "@metriport/core/domain/patient";
import AthenaHealthApi from "@metriport/core/external/athenahealth/index";
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { processAsyncError } from "@metriport/core/util/error/shared";
import { out } from "@metriport/core/util/log";
import { capture } from "@metriport/core/util/notifications";
import { errorToString } from "@metriport/shared";
import { getFacilityMappingOrFail } from "../../../../command/mapping/facility";
import { findOrCreatePatientMapping, getPatientMapping } from "../../../../command/mapping/patient";
import { queryDocumentsAcrossHIEs } from "../../../../command/medical/document/document-query";
import { createPatient as createMetriportPatient } from "../../../../command/medical/patient/create-patient";
import {
  getPatientByDemo,
  getPatientOrFail,
} from "../../../../command/medical/patient/get-patient";
import { EhrSources } from "../../shared";
import { collapsePatientDemosFhir, createMetriportPatientDemosFhir } from "../../shared-fhir";
import { createAthenaClient } from "../shared";

const parallelPatientMatches = 5;

export type SyncAthenaPatientIntoMetriportParams = {
  cxId: string;
  athenaPracticeId: string;
  athenaPatientId: string;
  api?: AthenaHealthApi;
  triggerDq?: boolean;
};

type GetPatientByDemoParams = {
  cxId: string;
  demo: PatientDemoData;
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
  const athenaPatient = await athenaApi.searchPatient({ cxId, patientId: athenaPatientId });

  const demos = createMetriportPatientDemosFhir(athenaPatient);

  const patients: Patient[] = [];
  const getPatientByDemoErrors: { error: unknown; cxId: string; demos: string }[] = [];
  const getPatientByDemoArgs: GetPatientByDemoParams[] = demos.map(demo => {
    return { cxId, demo };
  });

  await executeAsynchronously(
    getPatientByDemoArgs,
    async (params: GetPatientByDemoParams) => {
      const { log } = out(`AthenaHealth getPatientByDemo - cxId ${cxId}`);
      try {
        const patient = await getPatientByDemo(params);
        if (patient) patients.push(patient);
      } catch (error) {
        const demosToString = JSON.stringify(params.demo);
        log(
          `Failed to get patient by demo for demos ${demosToString}. Cause: ${errorToString(error)}`
        );
        getPatientByDemoErrors.push({ error, ...params, demos: demosToString });
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
        ...collapsePatientDemosFhir(demos),
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
