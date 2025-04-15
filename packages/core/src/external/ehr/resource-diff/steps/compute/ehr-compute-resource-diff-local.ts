import { sleep } from "@metriport/shared";
import { updateBundle } from "../../bundle/update-bundle";
import { computeResourceDiff } from "../../compute-diff";
import { BundleType } from "../../shared";
import {
  ComputeResourceDiffRequests,
  EhrComputeResourceDiffHandler,
} from "./ehr-compute-resource-diff";

export class EhrComputeResourceDiffLocal implements EhrComputeResourceDiffHandler {
  constructor(private readonly waitTimeInMillis: number) {}

  async computeResourceDiff(params: ComputeResourceDiffRequests): Promise<void> {
    for (const param of params) {
      const { ehr, cxId, metriportPatientId, ehrPatientId, existingResources, newResource } = param;
      const matchedResourceIds = computeResourceDiff({ existingResources, newResource });
      if (matchedResourceIds.length > 0) {
        await updateBundle({
          ehr,
          cxId,
          metriportPatientId,
          ehrPatientId,
          bundleType: BundleType.METRIPORT_ONLY,
          resource: newResource,
          resourceType: newResource.resourceType,
        });
      }
    }
    if (this.waitTimeInMillis > 0) await sleep(this.waitTimeInMillis);
  }
}
