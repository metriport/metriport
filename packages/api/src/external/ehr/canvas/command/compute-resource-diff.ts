import CanvasApi, {
  isSupportedCanvasDiffResource,
} from "@metriport/core/external/ehr/canvas/index";
import { ResourceWithId } from "@metriport/core/external/ehr/resource-diff/compute/ehr-compute-resource-diff";
import { buildEhrComputeResourceDiffHandler } from "@metriport/core/external/ehr/resource-diff/compute/ehr-compute-resource-diff-factory";
import { capture } from "@metriport/core/util/notifications";
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
import { saveCanvasResourceDiff } from "./save-resource-diff";

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
  let existingResources: FhirResource[] = [];
  if (direction === ResourceDiffDirection.DIFF_EHR) {
    if (!isSupportedCanvasDiffResource(resourceType)) {
      throw new BadRequestError("Resource type is not supported for resource diff", undefined, {
        resourceType,
      });
    }
    const extraParams: Record<string, string> = {};
    if (resource.resourceType === "Medication") {
      const code = resource.code.coding[0].code;
      const system = resource.code.coding[0].system;
      if (!code || !system) {
        await saveCanvasResourceDiff({
          cxId,
          canvasPatientId,
          resourceId: resource.id,
          matchedResourceIds: [],
          direction,
        });
        throw new BadRequestError("Medication resource must have a code", undefined, {
          resource: JSON.stringify(resource),
        });
      }
      extraParams["code"] = `${system}|${code}`;
    }
    const canvasApi = api ?? (await createCanvasClient({ cxId, practiceId: canvasPracticeId }));
    try {
      existingResources = await canvasApi.getFhirResourcesByResourceType({
        cxId,
        patientId: canvasPatientId,
        resourceType,
        extraParams,
      });
    } catch (error) {
      const msg = "Error getting existing resources @ Canvas";
      capture.message(msg, {
        extra: {
          resource: JSON.stringify(resource),
          cxId,
          canvasPracticeId,
          canvasPatientId,
          context: "canvas.compute-resource-diff",
          error,
        },
        level: "warning",
      });
    }
  } else if (direction === ResourceDiffDirection.DIFF_METRIPORT) {
    if (!isResourceTypeForConsolidation(resourceType)) {
      throw new BadRequestError("Resource type is not supported for resource diff", undefined, {
        resourceType,
      });
    }
    const payload: GetConsolidatedPatientData = {
      patient: metriportPatient,
      resources: [resourceType],
    };
    const bundle = await getConsolidatedPatientData(payload);
    existingResources = bundle.entry?.map(entry => fhirResourceSchema.parse(entry.resource)) ?? [];
  }
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
