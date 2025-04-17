import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { getCxMappingOrFail } from "../../command/mapping/cx";
import { getPatientMappings } from "../../command/mapping/patient";
import { getPatientOrFail } from "../../command/medical/patient/get-patient";
import { startCanvasResourceDiff } from "./canvas/command/resource-diff/start-resource-diff";

export type StartResourceDiffParams = {
  cxId: string;
  patientId: string;
};

export async function startResourceDiff({
  cxId,
  patientId,
}: StartResourceDiffParams): Promise<void> {
  const patient = await getPatientOrFail({ cxId, id: patientId });
  const patientMappings = await getPatientMappings({
    cxId,
    id: patient.id,
  });
  if (patientMappings.length < 0) return;
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
      });
    }
  }
}
