import { Bundle } from "@medplum/fhirtypes";
import { GetBundleByResourceTypeClientRequest } from "../../command/ehr-get-resouce-bundle-by-resource-id";
import { createAthenaHealthClient } from "../shared";

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
  const client = await createAthenaHealthClient({
    cxId,
    practiceId,
    ...(tokenId && { tokenId }),
  });
  const bundle = await client.getResourceBundleByResourceId({
    cxId,
    metriportPatientId,
    athenaPatientId: ehrPatientId,
    resourceId,
    resourceType,
    useCachedBundle,
  });
  return bundle;
}
