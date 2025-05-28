import { Bundle } from "@medplum/fhirtypes";
import { GetBundleByResourceTypeClientRequest } from "../../command/get-bundle-by-resource-type/ehr-get-bundle-by-resource-type";
import { createAthenaHealthClient } from "../shared";

export async function getBundleByResourceType(
  params: GetBundleByResourceTypeClientRequest
): Promise<Bundle> {
  const {
    environment,
    tokenId,
    cxId,
    practiceId,
    metriportPatientId,
    ehrPatientId,
    resourceType,
    useCachedBundle,
  } = params;
  const client = await createAthenaHealthClient({
    environment,
    cxId,
    practiceId,
    ...(tokenId && { tokenId }),
  });
  const bundle = await client.getBundleByResourceType({
    cxId,
    metriportPatientId,
    athenaPatientId: ehrPatientId,
    resourceType,
    useCachedBundle,
  });
  return bundle;
}
