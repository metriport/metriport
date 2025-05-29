import { processAsyncError } from "@metriport/core/util/error/shared";
import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { MetriportError } from "@metriport/shared";
import { EhrSource, EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { getCxMappingsByCustomer } from "../../../../../../command/mapping/cx";
import { getPatientMappings } from "../../../../../../command/mapping/patient";
import { createCanvasClientWithTokenIdAndEnvironment } from "../../../../canvas/shared";
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
      const { tokenId } = await createCanvasClientWithTokenIdAndEnvironment({
        cxId,
        practiceId: patientMapping.externalId,
      });
      startCreateResourceDiffBundlesJobAtEhr({
        ehr: EhrSources.canvas,
        cxId,
        ehrPatientId: patientMapping.externalId,
        requestId,
        tokenId,
      }).catch(processAsyncError(`${EhrSources.canvas} startCreateResourceDiffBundlesJobAtEhr`));
    }
  }
}

async function startCreateResourceDiffBundlesJobAtEhr({
  ehr,
  tokenId,
  cxId,
  ehrPatientId,
  requestId,
}: {
  ehr: EhrSource;
  tokenId?: string;
  cxId: string;
  ehrPatientId: string;
  requestId: string;
}): Promise<void> {
  const cxMappings = await getCxMappingsByCustomer({ cxId, source: ehr });
  const cxMapping = cxMappings[0];
  if (!cxMapping) throw new MetriportError("CX mapping not found", undefined, { ehr, cxId });
  if (cxMappings.length > 1) {
    throw new MetriportError("Multiple CX mappings found", undefined, { ehr, cxId });
  }
  await startCreateResourceDiffBundlesJob({
    ehr,
    tokenId,
    cxId,
    practiceId: cxMapping.externalId,
    ehrPatientId,
    requestId,
  });
}
