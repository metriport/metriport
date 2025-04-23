import { sleep } from "@metriport/shared";
import { fetchEhrBundle as fetchEhrBundleFromApi } from "../../api/fetch-bundle";
import { getSupportedResourcesByEhr } from "../bundle-shared";
import { EhrRefreshEhrBundlesHandler, RefreshEhrBundlesRequest } from "./ehr-refresh-ehr-bundles";

export class EhrRefreshEhrBundlesLocal implements EhrRefreshEhrBundlesHandler {
  constructor(private readonly waitTimeInMillis: number) {}

  async refreshEhrBundles({
    ehr,
    cxId,
    practiceId,
    patientId,
  }: RefreshEhrBundlesRequest): Promise<void> {
    const supportedResources = getSupportedResourcesByEhr(ehr);
    for (const resourceType of supportedResources) {
      await fetchEhrBundleFromApi({
        ehr,
        cxId,
        practiceId,
        patientId,
        resourceType,
        useCachedBundle: false,
      });
    }
    if (this.waitTimeInMillis > 0) await sleep(this.waitTimeInMillis);
  }
}
