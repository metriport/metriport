import { errorToString, sleep } from "@metriport/shared";
import { out } from "../../../util/log";
import { capture } from "../../../util/notifications";
import { saveResourceDiff } from "../api/save-resource-diff";
import { EhrResourceDifftHandler, ProcessResourceDiffRequest } from "./ehr-resource-diff";
import { isNewResource } from "./utils";

export class EhrResourceDiffLocal implements EhrResourceDifftHandler {
  constructor(private readonly waitTimeInMillis: number) {}

  async processResourceDiff({
    ehr,
    cxId,
    patientId,
    existingResources,
    newResource,
    direction,
  }: ProcessResourceDiffRequest): Promise<void> {
    const { log } = out(
      `processResourceDiff.local - ehr ${ehr} cxId ${cxId} patientId ${patientId} resourceId ${newResource.id}`
    );
    if (existingResources.length < 0) return;
    const resourceId = newResource.id;
    try {
      const matchedResourceIds = isNewResource({
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
    } catch (error) {
      const msg = `Failure while processing resource diff @ Ehr`;
      log(`${msg}. Cause: ${errorToString(error)}`);
      capture.error(msg, {
        extra: {
          ehr,
          cxId,
          patientId,
          resourceId,
          direction,
          context: "ehr-resource-diff-local.processResourceDiff",
          error,
        },
      });
      throw error;
    }
  }
}
