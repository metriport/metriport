import CanvasApi, {
  isSupportedCanvasDiffResource,
} from "@metriport/core/external/ehr/canvas/index";
import { buildEhrComputeResourceDiffHandler } from "@metriport/core/external/ehr/resource-diff/compute/ehr-compute-resource-diff-factory";
import { out } from "@metriport/core/util/log";
import { capture } from "@metriport/core/util/notifications";
import { BadRequestError, MetriportError, errorToString } from "@metriport/shared";
import { FhirResource } from "@metriport/shared/interface/external/ehr/fhir-resource";
import { ResourceDiffDirection } from "@metriport/shared/interface/external/ehr/resource-diff";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { getPatientMappingOrFail } from "../../../../../command/mapping/patient";
import { getPatientOrFail } from "../../../../../command/medical/patient/get-patient";
import { createCanvasClient } from "../../shared";
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
  await getPatientOrFail({
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

    const canvasApi = api ?? (await createCanvasClient({ cxId, practiceId: canvasPracticeId }));
    try {
      existingResources = await canvasApi.getFhirResourcesByResource({
        cxId,
        patientId: canvasPatientId,
        resource,
      });
    } catch (error) {
      const msg = "Error getting existing resources @ Canvas";
      out(
        `computeCanvasResourceDiff - cxId: ${cxId} canvasPatientId: ${canvasPatientId} canvasPracticeId: ${canvasPracticeId}`
      ).log(`${msg}. Cause: ${errorToString(error)}`);
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
      await saveCanvasResourceDiff({
        cxId,
        canvasPatientId,
        resourceId: resource.id,
        matchedResourceIds: [],
        direction,
      });
      return;
    }
  } else {
    throw new MetriportError("Cannot compute resource diff in this direction", undefined, {
      direction,
    });
  }
  const ehrResourceDiffHandler = buildEhrComputeResourceDiffHandler();
  await ehrResourceDiffHandler.computeResourceDiff({
    ehr: EhrSources.canvas,
    cxId,
    patientId: canvasPatientId,
    existingResources,
    newResource: resource,
    direction,
  });
}
