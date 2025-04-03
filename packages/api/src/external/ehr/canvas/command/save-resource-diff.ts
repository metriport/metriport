import { MetriportError } from "@metriport/shared";
import { ResourceDiffDirection } from "@metriport/shared/interface/external/ehr/resource-diff";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { getPatientMappingOrFail } from "../../../../command/mapping/patient";
import { createOrUpdateResourceMappingReversed } from "../../../../command/mapping/resource-reversed";
import { getPatientOrFail } from "../../../../command/medical/patient/get-patient";
export type SaveResourceDiffParams = {
  cxId: string;
  canvasPatientId: string;
  resourceId: string;
  direction: ResourceDiffDirection;
  matchedResourceIds: string[];
};

export async function saveResourceDiff({
  cxId,
  canvasPatientId,
  resourceId,
  direction,
  matchedResourceIds,
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
  if (direction === ResourceDiffDirection.DIFF_METRIPORT) {
    throw new MetriportError(`Cannot save resources in the ${direction} direction`);
  } else if (direction === ResourceDiffDirection.DIFF_EHR) {
    await createOrUpdateResourceMappingReversed({
      cxId,
      patientId: metriportPatient.id,
      patientMappingExternalId: canvasPatientId,
      resourceId,
      externalId: matchedResourceIds.sort().join(","),
      source: EhrSources.canvas,
    });
  } else {
    throw new MetriportError("Invalid direction", undefined, { direction });
  }
}
