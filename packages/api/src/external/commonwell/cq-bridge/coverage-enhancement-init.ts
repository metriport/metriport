import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { MetriportError } from "@metriport/core/util/error/metriport-error";
import { groupBy } from "lodash";
import { getOrganizationOrFail } from "../../../command/medical/organization/get-organization";
import { getPatients } from "../../../command/medical/patient/get-patient";
import { getPatientsToEnhanceCoverage } from "./coverage-enhancement-get-patients";
import { makeCoverageEnhancer } from "./coverage-enhancer-factory";
import { setCQLinkStatus } from "./cq-link-status";

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

  const ecId = coverageEnhancer.makeId();

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

  const patients = await getPatientsToProcess();
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
      ecId,
      cxId,
      orgOID: org.oid,
      patientIds,
      fromOrgChunkPos: fromOrgPos,
    });
  }
}
