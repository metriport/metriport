import { Bundle } from "@medplum/fhirtypes";
import { GetBundleByResourceTypeClientRequest } from "../../command/ehr-get-rresouce-bundle-by-resource-id";
import { createCanvasClient } from "../shared";

export async function getResourceBundleByResourceId(
  params: GetBundleByResourceTypeClientRequest
): Promise<Bundle> {
  const {
    tokenId,
    cxId,
    practiceId,
    metriportPatientId,
    ehrPatientId,
    resourceType,
    resourceId,
    useCachedBundle,
  } = params;
  const client = await createCanvasClient({
    cxId,
    practiceId,
    ...(tokenId && { tokenId }),
  });
  const bundle = await client.getResourceBundleByResourceId({
    cxId,
    metriportPatientId,
    canvasPatientId: ehrPatientId,
    resourceId,
    resourceType,
    useCachedBundle,
  });
  return bundle;
}
