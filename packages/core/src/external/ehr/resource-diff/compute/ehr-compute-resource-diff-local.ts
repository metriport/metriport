import { BadRequestError, ResourceDiffDirection, sleep } from "@metriport/shared";
import { saveResourceDiff } from "../../api/resource-diff/save-resource-diff";
import { computeResourceDiff } from "../utils";
import {
  ComputeResourceDiffRequest,
  EhrComputeResourceDiffHandler,
} from "./ehr-compute-resource-diff";

export class EhrComputeResourceDiffLocal implements EhrComputeResourceDiffHandler {
  constructor(private readonly waitTimeInMillis: number) {}

  async computeResourceDiff({
    ehr,
    cxId,
    patientId,
    existingResources,
    newResource,
    direction,
  }: ComputeResourceDiffRequest): Promise<void> {
    if (direction !== ResourceDiffDirection.DIFF_EHR) {
      throw new BadRequestError("This direction is not supported yet", undefined, { direction });
    }
    const matchedResourceIds = computeResourceDiff({ existingResources, newResource });
    await saveResourceDiff({
      ehr,
      cxId,
      patientId,
      resourceId: newResource.id,
      direction,
      matchedResourceIds,
    });
    if (this.waitTimeInMillis > 0) await sleep(this.waitTimeInMillis);
  }
}
