import CanvasApi, {
  isSupportedCanvasDiffResource,
  SupportedCanvasDiffResource,
  supportedCanvasDiffResources,
} from "@metriport/core/external/ehr/canvas/index";
import { BadRequestError } from "@metriport/shared";
import { Bundle } from "@metriport/shared/interface/external/ehr/fhir-resource";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { getPatientMappingOrFail } from "../../../../../command/mapping/patient";
import { getPatientOrFail } from "../../../../../command/medical/patient/get-patient";
import { createCanvasClient } from "../../shared";

export type FetchOrReplaceCanvasBundleParams = {
  cxId: string;
  canvasPracticeId: string;
  canvasPatientId: string;
  resourceType?: SupportedCanvasDiffResource;
  useExistingBundle?: boolean;
  api?: CanvasApi;
};

export async function fetchOrReplaceCanvasBundle({
  cxId,
  canvasPracticeId,
  canvasPatientId,
  resourceType,
  useExistingBundle = false,
  api,
}: FetchOrReplaceCanvasBundleParams): Promise<Bundle> {
  const existingPatient = await getPatientMappingOrFail({
    cxId,
    externalId: canvasPatientId,
    source: EhrSources.canvas,
  });
  const metriportPatient = await getPatientOrFail({
    cxId,
    id: existingPatient.patientId,
  });
  if (resourceType && !isSupportedCanvasDiffResource(resourceType)) {
    throw new BadRequestError("Resource type is not supported for resource diff", undefined, {
      resourceType,
    });
  }
  const bundle: Bundle = { resourceType: "Bundle", entry: [] };
  const resourceTypes = resourceType ? [resourceType] : supportedCanvasDiffResources;
  for (const resourceType of resourceTypes) {
    const canvasApi = api ?? (await createCanvasClient({ cxId, practiceId: canvasPracticeId }));
    const resourceBundle = await canvasApi.getBundleByResourceType({
      cxId,
      metriportPatientId: metriportPatient.id,
      ehrPatientId: canvasPatientId,
      resourceType,
      useExistingBundle,
    });
    if (!resourceBundle) continue;
    bundle.entry.push(...resourceBundle.entry);
  }
  return bundle;
}
