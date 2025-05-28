import { Bundle } from "@medplum/fhirtypes";
import { createCanvasClient } from "../shared";
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
  const client = await createCanvasClient({ cxId, practiceId });
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
