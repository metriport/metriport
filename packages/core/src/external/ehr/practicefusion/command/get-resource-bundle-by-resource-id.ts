import { Bundle } from "@medplum/fhirtypes";
import { GetResourceBundleByResourceIdClientRequest } from "../../command/get-resource-bundle-by-resource-id";
import { createPracticeFusionClient } from "../shared";

export async function getResourceBundleByResourceId(
  params: GetResourceBundleByResourceIdClientRequest
): Promise<Bundle> {
  const {
    tokenInfo,
    cxId,
    practiceId,
    metriportPatientId,
    ehrPatientId,
    resourceType,
    resourceId,
    useCachedBundle,
  } = params;
  const client = await createPracticeFusionClient({
    cxId,
    practiceId,
    ...(tokenInfo ? { tokenInfo } : {}),
  });
  const bundle = await client.getResourceBundleByResourceId({
    cxId,
    metriportPatientId,
    practicefusionPatientId: ehrPatientId,
    resourceType,
    resourceId,
    useCachedBundle,
  });
  return bundle;
}
