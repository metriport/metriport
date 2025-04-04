import { sleep } from "@metriport/shared";
import { saveResourceDiff } from "../../api/save-resource-diff";
import { computeResourceDiff } from "../utils";
import {
  EhrComputeResourceDiffHandler,
  ComputeResourceDiffRequest,
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
    if (existingResources.length < 0) return;
    const resourceId = newResource.id;
    const matchedResourceIds = computeResourceDiff({
      existingResources,
      newResource,
    });
    await saveResourceDiff({
      ehr,
      cxId,
      patientId,
      resourceId,
      direction,
      matchedResourceIds,
    });
    if (this.waitTimeInMillis > 0) await sleep(this.waitTimeInMillis);
  }
}
