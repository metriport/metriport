import { processAsyncError } from "@metriport/core/util/error/shared";
import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { MetriportError } from "@metriport/shared";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { getCxMappingsByCustomer } from "../../command/mapping/cx";
import { getPatientMappings } from "../../command/mapping/patient";
import { startCanvasResourceDiff } from "./canvas/command/resource-diff/start-resource-diff";

export type StartResourceDiffParams = {
  cxId: string;
  patientId: string;
};

export async function startResourceDiff({
  cxId,
  patientId,
}: StartResourceDiffParams): Promise<void> {
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
      startCanvasResourceDiff({
        cxId,
        canvasPracticeId: cxMapping.externalId,
        canvasPatientId: patientMapping.externalId,
        requestId,
      }).catch(processAsyncError(`startCanvasResourceDiff`));
    }
  }
}
