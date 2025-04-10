import CanvasApi, {
  isSupportedCanvasDiffResource,
} from "@metriport/core/external/ehr/canvas/index";
import { BadRequestError } from "@metriport/shared";
import { FhirResource } from "@metriport/shared/interface/external/ehr/fhir-resource";
import { ResourceDiffDirection } from "@metriport/shared/interface/external/ehr/resource-diff";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { getPatientMappingOrFail } from "../../../../../command/mapping/patient";
import { getPatientOrFail } from "../../../../../command/medical/patient/get-patient";
import { createCanvasClient } from "../../shared";

export type FetchCanvasResourcesParams = {
  cxId: string;
  canvasPracticeId: string;
  canvasPatientId: string;
  resourceType: string;
  direction: ResourceDiffDirection;
  useS3?: boolean;
  api?: CanvasApi;
};

export async function fetchCanvasOrMetriportResources({
  cxId,
  canvasPracticeId,
  canvasPatientId,
  resourceType,
  direction,
  useS3 = true,
  api,
}: FetchCanvasResourcesParams): Promise<FhirResource[]> {
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
  if (!isSupportedCanvasDiffResource(resourceType)) {
    throw new BadRequestError("Resource type is not supported for resource diff", undefined, {
      resourceType,
    });
  }
  const canvasApi = api ?? (await createCanvasClient({ cxId, practiceId: canvasPracticeId }));
  return await canvasApi.getFhirResourcesByResourceType({
    cxId,
    patientId: canvasPatientId,
    resourceType,
    useS3,
  });
}
