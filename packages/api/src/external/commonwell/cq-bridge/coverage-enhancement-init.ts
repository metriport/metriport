import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { MetriportError } from "@metriport/core/util/error/metriport-error";
import { groupBy } from "lodash";
import { getOrganizationOrFail } from "../../../command/medical/organization/get-organization";
import { getPatients } from "../../../command/medical/patient/get-patient";
import { getPatientsToEnhanceCoverage, PatientToLink } from "./coverage-enhancement-get-patients";
import { makeCoverageEnhancer } from "./coverage-enhancer-factory";
import { setCQLinkStatus } from "./cq-link-status";
import { capture } from "../../../shared/notifications";
import { Patient } from "../../../domain/medical/patient";
import { CWLinkStatus, PatientDataCommonwell } from "../patient-shared";

const cqLinkStatusInitial = "processing";
const parallelPatientUpdates = 20;
const coverageEnhancer = makeCoverageEnhancer();

/**
 * Trigger the CQ link (enhanced coverage) for all patients that are not linked or are
 * already processing.
 */
export async function initEnhancedCoverage(
  cxIds: string[],
  patientIds?: string[],
  fromOrgPos?: number
): Promise<void> {
  if (!coverageEnhancer) {
    console.log(`No coverage enhancher, skipping...`);
    return;
  }

  const getPatientsToProcess = async () => {
    if (patientIds && patientIds.length > 0) {
      const cxId = cxIds[0];
      if (cxIds.length != 1 || !cxId) {
        throw new MetriportError(`Exacly one cxId must be set when patientIds are present`);
      }
      return getPatients({ cxId, patientIds });
    }
    return getPatientsToEnhanceCoverage(cxIds);
  };

  const getCWLinkStatus = (patient: Patient): string => {
    return (patient.data.externalData?.COMMONWELL as PatientDataCommonwell).status as CWLinkStatus;
  };

  let patients = await getPatientsToProcess();

  // TODO run the same relinking logic on any failed patients?
  // for patient in patients, if cw link status is failed, notify sentry
  let failedPatients: (PatientToLink | Patient)[] = [];
  if (patients.length > 0) {
    if ("cwLinkStatus" in patients[0]) {
      // patients are of type PatientToLink
      failedPatients = (patients as PatientToLink[]).filter(
        patient => patient.cwLinkStatus === "failed"
      );
      patients = (patients as PatientToLink[]).filter(patient => patient.cwLinkStatus !== "failed");
    } else {
      failedPatients = (patients as Patient[]).filter(
        patient => getCWLinkStatus(patient) === "failed"
      );
      patients = (patients as Patient[]).filter(patient => getCWLinkStatus(patient) !== "failed");
    }
  }
  if (failedPatients.length > 0) {
    notifyCWUnlinked(failedPatients);
  }

  const patientsByCx = groupBy(patients, "cxId");
  const entries = Object.entries(patientsByCx);
  for (const [cxId, patients] of entries) {
    console.log(`CX ${cxId} has ${patients.length} patients to run Enhanced Coverage`);
  }
  for (const [cxId, patients] of entries) {
    // update the patients to indicate they're being processed
    const updatePatientsPromise = executeAsynchronously(
      patients as Patient[],
      async ({ cxId, id: patientId }) => {
        await setCQLinkStatus({ cxId, patientId, cqLinkStatus: cqLinkStatusInitial });
      },
      { numberOfParallelExecutions: parallelPatientUpdates }
    );
    const orgPromise = getOrganizationOrFail({ cxId });

    const [, org] = await Promise.all([updatePatientsPromise, orgPromise]);

    const patientIds = (patients as Patient[]).map(p => p.id);
    await coverageEnhancer.enhanceCoverage({
      cxId,
      orgOID: org.oid,
      patientIds,
      fromOrgChunkPos: fromOrgPos,
    });
  }
}

function notifyCWUnlinked(patients: PatientToLink[] | Patient[]): void {
  if (!patients || !patients.length) return;

  const patientsByCx = groupBy(patients, "cxId");
  const msg = `Found patients with stale enhanced coverage`;
  console.log(msg + ` - count: ${patients.length}: ${JSON.stringify(patientsByCx)}`);
  capture.message(msg, {
    extra: { patientsByCx },
    level: "warning",
  });
}
