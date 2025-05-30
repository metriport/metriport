import { processAsyncError } from "@metriport/core/util/error/shared";
import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { MetriportError } from "@metriport/shared";
import { EhrSource, EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { getCxMappingOrFail, getCxMappingsByCustomer } from "../../../../../../command/mapping/cx";
import { getPatientMappings } from "../../../../../../command/mapping/patient";
import { startCreateResourceDiffBundlesJob } from "./start-job";

export type CreateResourceDiffBundlesParams = {
  cxId: string;
  patientId: string;
  requestId?: string;
};

/**
 * Starts the resource diff bundles job asynchronously for each EHR integration
 *
 * @param cxId - The cxId of the patient.
 * @param patientId - The patientId of the patient.
 * @param requestId - The requestId of the resource diff bundles job. Optional, will generate a new one if not provided.
 */
export async function startCreateResourceDiffBundlesJobsAcrossEhrs({
  cxId,
  patientId,
  requestId: requestIdParam,
}: CreateResourceDiffBundlesParams): Promise<void> {
  const patientMappings = await getPatientMappings({ cxId, id: patientId });
  if (patientMappings.length < 1) return;
  const requestId = requestIdParam ?? uuidv7();
  for (const patientMapping of patientMappings) {
    if (patientMapping.source === EhrSources.canvas) {
      startCreateResourceDiffBundlesJobAtEhr({
        ehr: EhrSources.canvas,
        cxId,
        ehrPatientId: patientMapping.externalId,
        requestId,
      }).catch(processAsyncError(`${EhrSources.canvas} startCreateResourceDiffBundlesJobAtEhr`));
    } else if (patientMapping.source === EhrSources.athena) {
      const athenaPracticeId = getAthenaPracticeId(patientMapping.externalId);
      startCreateResourceDiffBundlesJobAtEhr({
        ehr: EhrSources.athena,
        cxId,
        practiceId: athenaPracticeId,
        ehrPatientId: patientMapping.externalId,
        requestId,
      }).catch(processAsyncError(`${EhrSources.athena} startCreateResourceDiffBundlesJobAtEhr`));
    }
  }
}

async function startCreateResourceDiffBundlesJobAtEhr({
  ehr,
  cxId,
  practiceId,
  ehrPatientId,
  requestId,
}: {
  ehr: EhrSource;
  cxId: string;
  practiceId?: string;
  ehrPatientId: string;
  requestId: string;
}): Promise<void> {
  const cxMapping = practiceId
    ? await getCxMappingOrFail({ source: ehr, externalId: practiceId })
    : await getCxMappingWithoutPracticeId({ cxId, ehr });
  await startCreateResourceDiffBundlesJob({
    ehr,
    cxId,
    practiceId: cxMapping.externalId,
    ehrPatientId,
    requestId,
  });
}

async function getCxMappingWithoutPracticeId({ cxId, ehr }: { cxId: string; ehr: EhrSources }) {
  const cxMappings = await getCxMappingsByCustomer({ cxId, source: ehr });
  const cxMapping = cxMappings[0];
  if (!cxMapping) throw new MetriportError("CX mapping not found", undefined, { ehr, cxId });
  if (cxMappings.length > 1) {
    throw new MetriportError("Multiple CX mappings found", undefined, { ehr, cxId });
  }
  return cxMapping;
}

export function getAthenaPracticeId(ehrPatientId: string) {
  const [patientPrefix, patientId] = ehrPatientId.split(".");
  if (!patientPrefix || !patientId) {
    throw new MetriportError("Invalid patient ID", undefined, { ehrPatientId });
  }
  if (!patientPrefix.startsWith("a-")) {
    throw new MetriportError("Invalid patient ID", undefined, { ehrPatientId });
  }
  return `a-1.${patientPrefix.replace("a-", "Practice-")}`;
}
