import { buildEhrStartResourceDiffHandler } from "@metriport/core/external/ehr/resource-diff/start/ehr-start-resource-diff-factory";
import { MetriportError } from "@metriport/shared";
import { ResourceDiffDirection } from "@metriport/shared/interface/external/ehr/resource-diff";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { getPatientMappingOrFail } from "../../../../../command/mapping/patient";
import { getPatientOrFail } from "../../../../../command/medical/patient/get-patient";

export type StartResourceDiffParams = {
  cxId: string;
  canvasPracticeId: string;
  canvasPatientId: string;
  direction: ResourceDiffDirection;
};

export async function startCanvasResourceDiff({
  cxId,
  canvasPracticeId,
  canvasPatientId,
  direction,
}: StartResourceDiffParams): Promise<void> {
  const existingPatient = await getPatientMappingOrFail({
    cxId,
    externalId: canvasPatientId,
    source: EhrSources.canvas,
  });
  const metriportPatient = await getPatientOrFail({
    cxId,
    id: existingPatient.patientId,
  });
  if (direction !== ResourceDiffDirection.DIFF_EHR) {
    throw new MetriportError("Cannot start resource diff in this direction", undefined, {
      direction,
    });
  }
  const ehrResourceDiffHandler = buildEhrStartResourceDiffHandler();
  await ehrResourceDiffHandler.startResourceDiff({
    ehr: EhrSources.canvas,
    cxId,
    practiceId: canvasPracticeId,
    metriportPatientId: metriportPatient.id,
    ehrPatientId: canvasPatientId,
    direction,
  });
}
