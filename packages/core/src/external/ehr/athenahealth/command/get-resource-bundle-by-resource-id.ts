import { Bundle } from "@medplum/fhirtypes";
import { createAthenaHealthClient } from "../shared";
import { GetResourceBundleByResourceParams } from "../../shared";

export async function getResourceBundleByResourceId(
  params: GetResourceBundleByResourceParams
): Promise<Bundle | undefined> {
  const {
    cxId,
    practiceId,
    metriportPatientId,
    ehrPatientId,
    resourceType,
    resourceId,
    useCachedBundle,
  } = params;
  const client = await createAthenaHealthClient({ cxId, practiceId });
  const bundle = await client.getResourceBundleByResourceId({
    cxId,
    metriportPatientId,
    athenaPatientId: ehrPatientId,
    resourceId,
    resourceType,
    ...(useCachedBundle && { useCachedBundle }),
  });
  return bundle;
}
