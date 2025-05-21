import { Bundle } from "@medplum/fhirtypes";
import { GetBundleByResourceTypeClientRequest } from "../../lambdas/get-bundle-by-resource-type/ehr-get-bundle-by-resource-type";
import { createCanvasClient } from "../shared";

export async function getBundleByResourceType(
  params: GetBundleByResourceTypeClientRequest
): Promise<Bundle> {
  const { cxId, practiceId, resourceType, environment, tokenId, metriportPatientId, ehrPatientId } =
    params;
  const client = await createCanvasClient({
    environment,
    cxId,
    practiceId,
    ...(tokenId && { tokenId }),
  });
  const bundle = await client.getBundleByResourceType({
    cxId,
    metriportPatientId,
    canvasPatientId: ehrPatientId,
    resourceType,
  });
  return bundle;
}
