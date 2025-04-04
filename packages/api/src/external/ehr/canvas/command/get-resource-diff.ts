import { MetriportError } from "@metriport/shared";
import { ResourceDiffDirection } from "@metriport/shared/interface/external/ehr/resource-diff";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { getPatientMappingOrFail } from "../../../../command/mapping/patient";
import {
  getMappedResourceIdsByPatientMappingExternalId,
  ResourceMappingReversedMapped,
} from "../../../../command/mapping/resource-reversed";
import { getPatientOrFail } from "../../../../command/medical/patient/get-patient";

export type GetResourceDiffParams = {
  cxId: string;
  canvasPatientId: string;
  direction: ResourceDiffDirection;
};

export async function getCanvasResourceDiffFromEhr({
  cxId,
  canvasPatientId,
  direction,
}: GetResourceDiffParams): Promise<ResourceMappingReversedMapped[]> {
  const existingPatient = await getPatientMappingOrFail({
    cxId,
    externalId: canvasPatientId,
    source: EhrSources.canvas,
  });
  const metriportPatient = await getPatientOrFail({
    cxId,
    id: existingPatient.patientId,
  });
  if (direction === ResourceDiffDirection.DIFF_EHR) {
    return await getMappedResourceIdsByPatientMappingExternalId({
      cxId,
      patientId: metriportPatient.id,
      patientMappingExternalId: canvasPatientId,
    });
  } else if (direction === ResourceDiffDirection.DIFF_METRIPORT) {
    throw new MetriportError("Cannot get resources in this direction", undefined, { direction });
  }
  return [];
}
