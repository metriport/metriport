import { Bundle } from "@medplum/fhirtypes";
import { BadRequestError } from "@metriport/shared";
import { GetResourceBundleByResourceIdClientRequest } from "../../command/get-resource-bundle-by-resource-id";
import { createHealthieClient } from "../shared";

export async function getResourceBundleByResourceId(
  params: GetResourceBundleByResourceIdClientRequest
): Promise<Bundle> {
  const {
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
  const client = await createHealthieClient({
    cxId,
    practiceId,
  });
  const bundle = await client.getResourceBundleByResourceId({
    cxId,
    metriportPatientId,
    healthiePatientId: ehrPatientId,
    resourceId,
    resourceType,
  });
  return bundle;
}
