import { MetriportError } from "@metriport/shared";
import { ResourceDiffDirection } from "@metriport/shared/interface/external/ehr/resource-diff";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { getPatientMappingOrFail } from "../../../../../command/mapping/patient";
import { createOrUpdateResourceMappingReversed } from "../../../../../command/mapping/resource-reversed";
import { getPatientOrFail } from "../../../../../command/medical/patient/get-patient";

export type SaveResourceDiffParams = {
  cxId: string;
  canvasPatientId: string;
  resourceId: string;
  matchedResourceIds: string[];
  direction: ResourceDiffDirection;
};

export async function saveCanvasResourceDiff({
  cxId,
  canvasPatientId,
  resourceId,
  matchedResourceIds,
  direction,
}: SaveResourceDiffParams): Promise<void> {
  const existingPatient = await getPatientMappingOrFail({
    cxId,
    externalId: canvasPatientId,
    source: EhrSources.canvas,
  });
  const metriportPatient = await getPatientOrFail({
    cxId,
    id: existingPatient.patientId,
  });
  const fonud = matchedResourceIds.length > 0;
  if (direction === ResourceDiffDirection.DIFF_EHR) {
    await createOrUpdateResourceMappingReversed({
      cxId,
      patientId: metriportPatient.id,
      patientMappingExternalId: canvasPatientId,
      resourceId,
      isMapped: fonud,
      source: EhrSources.canvas,
    });
  } else {
    throw new MetriportError("Cannot save resources in this direction", undefined, { direction });
  }
}
