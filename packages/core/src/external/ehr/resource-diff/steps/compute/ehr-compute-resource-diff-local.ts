import { sleep } from "@metriport/shared";
import { updateWorkflowTotal } from "../../../api/update-workflow-total";
import { BundleType } from "../../../bundle/bundle-shared";
import { updateBundle as updateBundleOnS3 } from "../../../bundle/commands/update-bundle";
import { computeResourceDiff } from "../../utils";
import {
  ComputeResourceDiffRequests,
  EhrComputeResourceDiffHandler,
} from "./ehr-compute-resource-diff";
export class EhrComputeResourceDiffLocal implements EhrComputeResourceDiffHandler {
  constructor(private readonly waitTimeInMillis: number) {}

  async computeResourceDiff(params: ComputeResourceDiffRequests): Promise<void> {
    for (const param of params) {
      const {
        ehr,
        cxId,
        metriportPatientId,
        ehrPatientId,
        existingResources,
        newResource,
        workflowId,
        requestId,
      } = param;
      try {
        const matchedResourceIds = computeResourceDiff({ existingResources, newResource });
        if (matchedResourceIds.length > 0) {
          await updateBundleOnS3({
            ehr,
            cxId,
            metriportPatientId,
            ehrPatientId,
            bundleType: BundleType.METRIPORT_ONLY,
            resource: newResource,
            resourceType: newResource.resourceType,
          });
        }
        await updateWorkflowTotal({
          ehr,
          cxId,
          patientId: metriportPatientId,
          workflowId,
          requestId,
          status: "successful",
        });
      } catch (error) {
        await updateWorkflowTotal({
          ehr,
          cxId,
          patientId: metriportPatientId,
          workflowId,
          requestId,
          status: "failed",
        });
      }
    }
    if (this.waitTimeInMillis > 0) await sleep(this.waitTimeInMillis);
  }
}
