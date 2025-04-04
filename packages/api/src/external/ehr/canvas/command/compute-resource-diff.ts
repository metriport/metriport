import CanvasApi from "@metriport/core/external/ehr/canvas/index";
import { ResourceWithId } from "@metriport/core/external/ehr/resource-diff/process/ehr-process-resource-diff";
import { buildEhrComputeResourceDiffHandler } from "@metriport/core/external/ehr/resource-diff/compute/ehr-compute-resource-diff-factory";
import { BadRequestError } from "@metriport/shared";
import {
  FhirResource,
  fhirResourceSchema,
} from "@metriport/shared/interface/external/ehr/fhir-resource";
import { ResourceDiffDirection } from "@metriport/shared/interface/external/ehr/resource-diff";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { isResourceTypeForConsolidation } from "@metriport/shared/medical";
import { getPatientMappingOrFail } from "../../../../command/mapping/patient";
import {
  getConsolidatedPatientData,
  GetConsolidatedPatientData,
} from "../../../../command/medical/patient/consolidated-get";
import { getPatientOrFail } from "../../../../command/medical/patient/get-patient";
import { createCanvasClient } from "../shared";

export type ComputeCanvasResourceDiffParams = {
  cxId: string;
  canvasPracticeId: string;
  canvasPatientId: string;
  resource: FhirResource;
  direction: ResourceDiffDirection;
  api?: CanvasApi;
};

export async function computeCanvasResourceDiff({
  cxId,
  canvasPracticeId,
  canvasPatientId,
  resource,
  direction,
  api,
}: ComputeCanvasResourceDiffParams): Promise<void> {
  const existingPatient = await getPatientMappingOrFail({
    cxId,
    externalId: canvasPatientId,
    source: EhrSources.canvas,
  });
  const metriportPatient = await getPatientOrFail({
    cxId,
    id: existingPatient.patientId,
  });
  const resourceType = resource.resourceType;
  if (!isResourceTypeForConsolidation(resourceType)) {
    throw new BadRequestError("Resource type is not supported for resource diff", undefined, {
      resourceType,
    });
  }
  let existingResources: FhirResource[] = [];
  if (direction === ResourceDiffDirection.DIFF_EHR) {
    const canvasApi = api ?? (await createCanvasClient({ cxId, practiceId: canvasPracticeId }));
    existingResources = await canvasApi.getFhirResourcesByResourceType({
      cxId,
      patientId: canvasPatientId,
      resourceType,
    });
  } else if (direction === ResourceDiffDirection.DIFF_METRIPORT) {
    const payload: GetConsolidatedPatientData = {
      patient: metriportPatient,
      resources: [resourceType],
    };
    const bundle = await getConsolidatedPatientData(payload);
    existingResources = bundle.entry?.map(entry => fhirResourceSchema.parse(entry.resource)) ?? [];
  }
  if (existingResources.length === 0) return;
  const ehrResourceDiffHandler = buildEhrComputeResourceDiffHandler();
  await ehrResourceDiffHandler.computeResourceDiff({
    ehr: EhrSources.canvas,
    cxId,
    patientId: canvasPatientId,
    existingResources: existingResources as ResourceWithId[],
    newResource: resource as ResourceWithId,
    direction,
  });
}
