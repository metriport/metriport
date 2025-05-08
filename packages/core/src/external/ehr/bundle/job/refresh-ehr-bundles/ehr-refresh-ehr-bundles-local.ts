import { sleep } from "@metriport/shared";
import { refreshEhrBundle } from "../../../api/bundle/refresh-ehr-bundle";
import { completeJob } from "../../../api/job/complete-job";
import { initializeJob } from "../../../api/job/initialize-job";
import { setJobEntryStatus } from "../../../api/job/set-entry-status";
import { updateJobTotal } from "../../../api/job/update-job-total";
import { getSupportedResourcesByEhr } from "../../bundle-shared";
import { EhrRefreshEhrBundlesHandler, RefreshEhrBundlesRequest } from "./ehr-refresh-ehr-bundles";

export class EhrRefreshEhrBundlesLocal implements EhrRefreshEhrBundlesHandler {
  constructor(private readonly waitTimeInMillis: number) {}

  async refreshEhrBundles({
    ehr,
    cxId,
    practiceId,
    patientId,
    jobId,
  }: RefreshEhrBundlesRequest): Promise<void> {
    await initializeJob({ cxId, jobId });
    const supportedResources = getSupportedResourcesByEhr(ehr);
    const totalResources = supportedResources.length;
    if (totalResources === 0) {
      await completeJob({ cxId, jobId });
      return;
    }
    await updateJobTotal({ cxId, jobId, total: totalResources });
    for (const resourceType of supportedResources) {
      try {
        await refreshEhrBundle({
          ehr,
          cxId,
          practiceId,
          patientId,
          resourceType,
        });
        await setJobEntryStatus({ cxId, jobId, entryStatus: "successful" });
      } catch (error) {
        await setJobEntryStatus({ cxId, jobId, entryStatus: "failed" });
        throw error;
      }
    }
    if (this.waitTimeInMillis > 0) await sleep(this.waitTimeInMillis);
  }
}
