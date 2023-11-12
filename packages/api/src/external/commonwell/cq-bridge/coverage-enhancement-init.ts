import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { groupBy } from "lodash";
import { getOrganizationOrFail } from "../../../command/medical/organization/get-organization";
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
export async function initEnhancedCoverage(cxIds: string[], fromOrgPos?: number): Promise<void> {
  if (!coverageEnhancer) {
    console.log(`No coverage enhancher, skipping...`);
    return;
  }

  const patients = await getPatientsToEnhanceCoverage(cxIds);
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
