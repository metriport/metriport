import { sleep } from "@metriport/shared";
import { fetchBundle as fetchBundleFromApi } from "../../api/fetch-bundle";
import { getSupportedResourcesByEhr } from "../bundle-shared";
import { EhrRefreshBundleHandler, RefreshBundleRequest } from "./ehr-refresh-resource-bundle";

export class EhrRefreshBundleLocal implements EhrRefreshBundleHandler {
  constructor(private readonly waitTimeInMillis: number) {}

  async refreshBundle({ ehr, cxId, practiceId, patientId }: RefreshBundleRequest): Promise<void> {
    const supportedResources = getSupportedResourcesByEhr(ehr);
    for (const resourceType of supportedResources) {
      await fetchBundleFromApi({
        ehr,
        cxId,
        practiceId,
        patientId,
        resourceType,
        useExistingBundle: false,
      });
    }
    if (this.waitTimeInMillis > 0) await sleep(this.waitTimeInMillis);
  }
}
