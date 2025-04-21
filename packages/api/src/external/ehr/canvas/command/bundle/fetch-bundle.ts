import CanvasApi, {
  isSupportedCanvasDiffResource,
  SupportedCanvasDiffResource,
  supportedCanvasDiffResources,
} from "@metriport/core/external/ehr/canvas/index";
import { BadRequestError } from "@metriport/shared";
import { Bundle, getDefaultBundle } from "@metriport/shared/interface/external/ehr/fhir-resource";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { getPatientMappingOrFail } from "../../../../../command/mapping/patient";
import { getPatientOrFail } from "../../../../../command/medical/patient/get-patient";
import { createCanvasClient } from "../../shared";

export type FetchCanvasBundleParams = {
  cxId: string;
  canvasPracticeId: string;
  canvasPatientId: string;
  api?: CanvasApi;
  resourceType?: SupportedCanvasDiffResource;
  useCachedBundle?: boolean;
};

export type FetchCanvasBundleResult = {
  bundle: Bundle;
  resourceTypes: SupportedCanvasDiffResource[];
};

/**
 * Fetches the resources for the patient that are in Canvas and returns a bundle of them.
 * If useCachedBundle is true, a previously fetched cached bundle used if available and valid.
 *
 * @param cxId - The cxId of the patient.
 * @param canvasPracticeId - The canvas practice id of the patient.
 * @param canvasPatientId - The canvas patient id of the patient.
 * @param api - The api to use to fetch the bundle. (optional)
 * @param resourceType - The resource type to fetch. (optional, if missing, all supported resources will be fetched)
 * @param useCachedBundle - Whether to use the cached bundle. (optional, defaults to true)
 * @returns The bundle of resources and the included resource types
 */
export async function fetchCanvasBundle({
  cxId,
  canvasPracticeId,
  canvasPatientId,
  api,
  resourceType: resourceTypeParam,
  useCachedBundle = true,
}: FetchCanvasBundleParams): Promise<FetchCanvasBundleResult> {
  const existingPatient = await getPatientMappingOrFail({
    cxId,
    externalId: canvasPatientId,
    source: EhrSources.canvas,
  });
  const metriportPatient = await getPatientOrFail({
    cxId,
    id: existingPatient.patientId,
  });
  const metriportPatientId = metriportPatient.id;
  if (resourceTypeParam && !isSupportedCanvasDiffResource(resourceTypeParam)) {
    throw new BadRequestError("Resource type is not supported for bundle", undefined, {
      resourceType: resourceTypeParam,
    });
  }

  const bundle = getDefaultBundle();
  const resourceTypes = resourceTypeParam ? [resourceTypeParam] : supportedCanvasDiffResources;

  const canvasApi = api ?? (await createCanvasClient({ cxId, practiceId: canvasPracticeId }));
  for (const resourceType of resourceTypes) {
    const resourceBundle = await canvasApi.getBundleByResourceType({
      cxId,
      metriportPatientId,
      canvasPatientId,
      resourceType,
      useCachedBundle,
    });
    bundle.entry.push(...resourceBundle.entry);
  }
  return { bundle, resourceTypes };
}
