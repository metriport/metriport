import { Bundle } from "@medplum/fhirtypes";
import { BadRequestError } from "@metriport/shared/";
import { GetResourceBundleByResourceIdClientRequest } from "../../command/get-resource-bundle-by-resource-id";
import { createElationHealthClient } from "../shared";

export async function getResourceBundleByResourceId(
  params: GetResourceBundleByResourceIdClientRequest
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
  if (!useCachedBundle) {
    throw new BadRequestError("useCachedBundle false is not supported");
  }
  const client = await createElationHealthClient({
    cxId,
    practiceId,
    ...(tokenId && { tokenId }),
  });
  const bundle = await client.getResourceBundleByResourceId({
    cxId,
    metriportPatientId,
    elationPatientId: ehrPatientId,
    resourceId,
    resourceType,
  });
  return bundle;
}
