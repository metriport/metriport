import { processAsyncError } from "@metriport/core/util/error/shared";
import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { MetriportError } from "@metriport/shared";
import { ResourceDiffDirection } from "@metriport/shared/interface/external/ehr/resource-diff";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { getCxMappingsByCustomer } from "../../command/mapping/cx";
import { getPatientMappings } from "../../command/mapping/patient";
import { createResourceDiffBundlesJob } from "./canvas/command/bundle/create-resource-diff-bundles-job/start-job";

export type CreateResourceDiffBundlesParams = {
  cxId: string;
  patientId: string;
  direction: ResourceDiffDirection;
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
  direction,
}: CreateResourceDiffBundlesParams): Promise<void> {
  const patientMappings = await getPatientMappings({ cxId, id: patientId });
  if (patientMappings.length < 0) return;
  const requestId = uuidv7();
  for (const patientMapping of patientMappings) {
    if (patientMapping.source === EhrSources.canvas) {
      const cxMappings = await getCxMappingsByCustomer({ cxId, source: EhrSources.canvas });
      const cxMapping = cxMappings[0];
      if (!cxMapping) {
        throw new MetriportError("Canvas CX mapping not found", undefined, {
          cxId,
          patientId,
        });
      }
      if (cxMappings.length > 1) {
        throw new MetriportError("Multiple Canvas CX mappings found", undefined, {
          cxId,
          patientId,
        });
      }
      createResourceDiffBundlesJob({
        cxId,
        canvasPracticeId: cxMapping.externalId,
        canvasPatientId: patientMapping.externalId,
        direction,
        requestId,
      }).catch(processAsyncError(`createResourceDiffBundlesJob`));
    }
  }
}
