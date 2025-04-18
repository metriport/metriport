import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { getCxMappingOrFail } from "../../command/mapping/cx";
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
      const cxMapping = await getCxMappingOrFail({
        externalId: patientMapping.externalId,
        source: patientMapping.source,
      });
      await startCanvasResourceDiff({
        cxId,
        canvasPracticeId: cxMapping.externalId,
        canvasPatientId: patientMapping.externalId,
        requestId,
      });
    }
  }
}
