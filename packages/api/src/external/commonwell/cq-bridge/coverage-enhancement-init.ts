import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { MetriportError } from "@metriport/core/util/error/metriport-error";
import { groupBy } from "lodash";
import { getOrganizationOrFail } from "../../../command/medical/organization/get-organization";
import { getPatients } from "../../../command/medical/patient/get-patient";
import { getPatientsToEnhanceCoverage } from "./coverage-enhancement-get-patients";
import { makeCoverageEnhancer } from "./coverage-enhancer-factory";
import { setCQLinkStatus } from "./cq-link-status";
import { capture } from "../../../shared/notifications";
import { Patient } from "../../../domain/medical/patient";
import { getLinkStatusCW } from "../patient";

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

  const getPatientsToProcess = async (): Promise<Patient[]> => {
    if (patientIds && patientIds.length > 0) {
      const cxId = cxIds[0];
      if (cxIds.length != 1 || !cxId) {
        throw new MetriportError(`Exacly one cxId must be set when patientIds are present`);
      }
      return getPatients({ cxId, patientIds });
    }
    return getPatientsToEnhanceCoverage(cxIds);
  };

  function filterPatients(patients: Patient[]): Patient[] {
    const [failedPatients, successPatients] = patients.reduce(
      (acc: [Patient[], Patient[]], patient) => {
        if (getLinkStatusCW(patient.data.externalData) === "failed") {
          acc[0].push(patient);
        } else {
          acc[1].push(patient);
        }
        return acc;
      },
      [[], []]
    );
    if (failedPatients.length > 0) {
      notifyCWUnlinked(failedPatients);
    }
    return successPatients;
  }

  const patients = filterPatients(await getPatientsToProcess());

  const patientsByCx = groupBy(patients, "cxId");
  const entries = Object.entries(patientsByCx);
  for (const [cxId, patients] of entries) {
    console.log(`CX ${cxId} has ${patients.length} patients to run Enhanced Coverage`);
  }
  for (const [cxId, patients] of entries) {
    // update the patients to indicate they're being processed
    const updatePatientsPromise = executeAsynchronously(
      patients,
      async ({ cxId, id: patientId }) => {
        await setCQLinkStatus({ cxId, patientId, cqLinkStatus: cqLinkStatusInitial });
      },
      { numberOfParallelExecutions: parallelPatientUpdates }
    );
    const orgPromise = getOrganizationOrFail({ cxId });

    const [, org] = await Promise.all([updatePatientsPromise, orgPromise]);

    const patientIds = patients.map(p => p.id);
    await coverageEnhancer.enhanceCoverage({
      cxId,
      orgOID: org.oid,
      patientIds,
      fromOrgChunkPos: fromOrgPos,
    });
  }
}

function notifyCWUnlinked(patients: Patient[]): void {
  if (!patients || !patients.length) return;

  const patientsByCx = groupBy(patients, "cxId");
  const msg = `Found patients with stale enhanced coverage`;
  console.log(msg + ` - count: ${patients.length}: ${JSON.stringify(patientsByCx)}`);
  capture.message(msg, {
    extra: { patientsByCx },
    level: "warning",
  });
}
