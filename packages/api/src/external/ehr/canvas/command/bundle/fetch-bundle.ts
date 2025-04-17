import CanvasApi, {
  isSupportedCanvasDiffResource,
  SupportedCanvasDiffResource,
  supportedCanvasDiffResources,
} from "@metriport/core/external/ehr/canvas/index";
import { BadRequestError } from "@metriport/shared";
import { Bundle, defaultBundle } from "@metriport/shared/interface/external/ehr/fhir-resource";
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
  useExistingBundle?: boolean;
};

export async function fetchCanvasBundle({
  cxId,
  canvasPracticeId,
  canvasPatientId,
  api,
  resourceType,
  useExistingBundle = true,
}: FetchCanvasBundleParams): Promise<Bundle> {
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
  if (resourceType && !isSupportedCanvasDiffResource(resourceType)) {
    throw new BadRequestError("Resource type is not supported for bundle", undefined, {
      resourceType,
    });
  }

  const bundle: Bundle = defaultBundle;
  const resourceTypes = resourceType ? [resourceType] : supportedCanvasDiffResources;

  const canvasApi = api ?? (await createCanvasClient({ cxId, practiceId: canvasPracticeId }));
  for (const resourceType of resourceTypes) {
    const resourceBundle = await canvasApi.getBundleByResourceType({
      cxId,
      metriportPatientId,
      canvasPatientId,
      resourceType,
      useExistingBundle,
    });
    bundle.entry.push(...resourceBundle.entry);
  }
  return bundle;
}
