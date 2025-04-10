import { BadRequestError } from "@metriport/shared";
import { ResourceDiffDirection } from "@metriport/shared/interface/external/ehr/resource-diff";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { getPatientMappingOrFail } from "../../../../../command/mapping/patient";
import {
  getResourceMappingsReversed,
  ResourceMappingReversedData,
} from "../../../../../command/mapping/resource-reversed";
import { getPatientOrFail } from "../../../../../command/medical/patient/get-patient";

export type GetResourceDiffParams = {
  cxId: string;
  canvasPatientId: string;
  direction: ResourceDiffDirection;
};

export async function getCanvasResourceDiffFromEhr({
  cxId,
  canvasPatientId,
  direction,
}: GetResourceDiffParams): Promise<ResourceMappingReversedData[]> {
  if (direction !== ResourceDiffDirection.DIFF_EHR) {
    throw new BadRequestError("This direction is not supported yet", undefined, { direction });
  }
  const existingPatient = await getPatientMappingOrFail({
    cxId,
    externalId: canvasPatientId,
    source: EhrSources.canvas,
  });
  const metriportPatient = await getPatientOrFail({
    cxId,
    id: existingPatient.patientId,
  });
  return await getResourceMappingsReversed({
    cxId,
    patientId: metriportPatient.id,
    patientMappingExternalId: canvasPatientId,
  });
}
