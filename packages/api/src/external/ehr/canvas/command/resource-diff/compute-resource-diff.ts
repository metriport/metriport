import { buildEhrComputeResourceDiffHandler } from "@metriport/core/external/ehr/resource-diff/compute/ehr-compute-resource-diff-factory";
import { BadRequestError } from "@metriport/shared";
import { FhirResource } from "@metriport/shared/interface/external/ehr/fhir-resource";
import { ResourceDiffDirection } from "@metriport/shared/interface/external/ehr/resource-diff";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { getPatientMappingOrFail } from "../../../../../command/mapping/patient";
import { getPatientOrFail } from "../../../../../command/medical/patient/get-patient";

export type ComputeCanvasResourceDiffParams = {
  cxId: string;
  canvasPatientId: string;
  newResource: FhirResource;
  existingResources: FhirResource[];
  direction: ResourceDiffDirection;
};

export async function computeCanvasResourceDiff({
  cxId,
  canvasPatientId,
  newResource,
  existingResources,
  direction,
}: ComputeCanvasResourceDiffParams): Promise<void> {
  if (direction !== ResourceDiffDirection.DIFF_EHR) {
    throw new BadRequestError("This direction is not supported yet", undefined, { direction });
  }
  const existingPatient = await getPatientMappingOrFail({
    cxId,
    externalId: canvasPatientId,
    source: EhrSources.canvas,
  });
  await getPatientOrFail({
    cxId,
    id: existingPatient.patientId,
  });
  const ehrResourceDiffHandler = buildEhrComputeResourceDiffHandler();
  await ehrResourceDiffHandler.computeResourceDiff({
    ehr: EhrSources.canvas,
    cxId,
    patientId: canvasPatientId,
    existingResources,
    newResource,
    direction,
  });
}
