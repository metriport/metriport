import { Bundle } from "@medplum/fhirtypes";
import { createCanvasClient } from "../shared";
import { GetResourceBundleByResourceIdParams } from "../../shared";

export async function getResourceBundleByResourceId(
  params: GetResourceBundleByResourceIdParams
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
    ...(useCachedBundle && { useCachedBundle }),
  });
  return bundle;
}
