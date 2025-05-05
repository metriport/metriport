import { processAsyncError } from "@metriport/core/util/error/shared";
import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { MetriportError } from "@metriport/shared";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { getCxMappingsByCustomer } from "../../../../command/mapping/cx";
import { getPatientMappings } from "../../../../command/mapping/patient";
import { startCreateResourceDiffBundlesJob } from "../job/create-resource-diff-bundles/start-job";

export type CreateResourceDiffBundlesParams = {
  cxId: string;
  patientId: string;
  requestId?: string;
};

/**
 * Creates the resource diff bundles job asynchronously for each EHR integration
 *
 * @param cxId - The cxId of the patient.
 * @param patientId - The patientId of the patient.
 * @param direction - The direction of the resource diff bundles to create.
 */
export async function createResourceDiffBundles({
  cxId,
  patientId,
  requestId: requestIdParam,
}: CreateResourceDiffBundlesParams): Promise<void> {
  const patientMappings = await getPatientMappings({ cxId, id: patientId });
  if (patientMappings.length < 1) return;
  const requestId = requestIdParam ?? uuidv7();
  for (const patientMapping of patientMappings) {
    if (patientMapping.source === EhrSources.canvas) {
      await createCanvasResourceDiffBundlesJob({
        ehr: EhrSources.canvas,
        cxId,
        patientId: patientMapping.externalId,
        requestId,
      });
    }
  }
}

async function createCanvasResourceDiffBundlesJob({
  ehr,
  cxId,
  patientId,
  requestId,
}: {
  ehr: EhrSources;
  cxId: string;
  patientId: string;
  requestId: string;
}): Promise<void> {
  const cxMappings = await getCxMappingsByCustomer({ cxId, source: ehr });
  const cxMapping = cxMappings[0];
  if (!cxMapping) throw new MetriportError("CX mapping not found", undefined, { ehr, cxId });
  if (cxMappings.length > 1) {
    throw new MetriportError("Multiple CX mappings found", undefined, { ehr, cxId });
  }
  startCreateResourceDiffBundlesJob({
    ehr,
    cxId,
    practiceId: cxMapping.externalId,
    patientId,
    requestId,
  }).catch(processAsyncError(`${ehr} createResourceDiffBundlesJob`));
}
