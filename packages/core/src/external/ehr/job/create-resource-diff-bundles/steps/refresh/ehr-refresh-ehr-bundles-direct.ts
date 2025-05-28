import { sleep } from "@metriport/shared";
import { getDefaultBundle } from "@metriport/shared/interface/external/ehr/fhir-resource";
import { refreshEhrBundle } from "../../../../api/bundle/refresh-ehr-bundle";
import { setCreateResourceDiffBundlesJobEntryStatus } from "../../../../api/job/create-resource-diff-bundles/set-entry-status";
import { BundleType } from "../../../../bundle/bundle-shared";
import { createOrReplaceBundle as createOrReplaceBundleOnS3 } from "../../../../bundle/command/create-or-replace-bundle";
import { buildEhrComputeResourceDiffBundlesHandler } from "../compute/ehr-compute-resource-diff-bundles-factory";
import { EhrRefreshEhrBundlesHandler, RefreshEhrBundlesRequest } from "./ehr-refresh-ehr-bundles";

export class EhrRefreshEhrBundlesDirect implements EhrRefreshEhrBundlesHandler {
  private readonly next = buildEhrComputeResourceDiffBundlesHandler();

  constructor(private readonly waitTimeInMillis: number) {}

  async refreshEhrBundles(payload: RefreshEhrBundlesRequest): Promise<void> {
    const {
      ehr,
      cxId,
      practiceId,
      metriportPatientId,
      ehrPatientId,
      resourceType,
      jobId,
      reportError = true,
    } = payload;
    const entryStatusParams = {
      ehr,
      cxId,
      practiceId,
      patientId: ehrPatientId,
      jobId,
    };
    try {
      await Promise.all([
        refreshEhrBundle({
          ehr,
          cxId,
          practiceId,
          patientId: ehrPatientId,
          resourceType,
        }),
        ...[BundleType.RESOURCE_DIFF_METRIPORT_ONLY, BundleType.RESOURCE_DIFF_EHR_ONLY].map(
          bundleType =>
            createOrReplaceBundleOnS3({
              ehr,
              cxId,
              metriportPatientId,
              ehrPatientId,
              bundleType,
              bundle: getDefaultBundle(),
              resourceType,
              jobId,
            })
        ),
      ]);
      await this.next.computeResourceDiffBundles({ ...payload, resourceType });
    } catch (error) {
      if (reportError) {
        await setCreateResourceDiffBundlesJobEntryStatus({
          ...entryStatusParams,
          entryStatus: "failed",
        });
      }
      throw error;
    }
    if (this.waitTimeInMillis > 0) await sleep(this.waitTimeInMillis);
  }
}
