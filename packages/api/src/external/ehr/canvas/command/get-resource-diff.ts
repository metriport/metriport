import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { getPatientMappingOrFail } from "../../../../command/mapping/patient";
import { getMappedResourceIdsByPatientMappingExternalId } from "../../../../command/mapping/resource-reversed";
import { getPatientOrFail } from "../../../../command/medical/patient/get-patient";

export type GetResourceDiffParams = {
  cxId: string;
  canvasPatientId: string;
};

export async function getResourceDiff({
  cxId,
  canvasPatientId,
}: GetResourceDiffParams): Promise<string[]> {
  const existingPatient = await getPatientMappingOrFail({
    cxId,
    externalId: canvasPatientId,
    source: EhrSources.canvas,
  });
  const metriportPatient = await getPatientOrFail({
    cxId,
    id: existingPatient.patientId,
  });
  return await getMappedResourceIdsByPatientMappingExternalId({
    cxId,
    patientId: metriportPatient.id,
    patientMappingExternalId: canvasPatientId,
  });
}
