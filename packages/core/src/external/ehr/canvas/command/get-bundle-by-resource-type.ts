import { Bundle } from "@medplum/fhirtypes";
import { GetBundleByResourceTypeClientRequest } from "../../command/get-bundle-by-resource-type";
import { createCanvasClient } from "../shared";

export async function getBundleByResourceType(
  params: GetBundleByResourceTypeClientRequest
): Promise<Bundle> {
  const {
    tokenInfo,
    cxId,
    practiceId,
    metriportPatientId,
    ehrPatientId,
    resourceType,
    useCachedBundle,
  } = params;
  const client = await createCanvasClient({
    cxId,
    practiceId,
    ...(tokenInfo ? { tokenInfo } : {}),
  });
  const bundle = await client.getBundleByResourceType({
    cxId,
    metriportPatientId,
    canvasPatientId: ehrPatientId,
    resourceType,
    useCachedBundle,
  });
  return bundle;
}
