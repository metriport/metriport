import { JwtTokenInfo, sleep } from "@metriport/shared";
import { getDefaultBundle } from "@metriport/shared/interface/external/ehr/fhir-resource";
import { setJobEntryStatus } from "../../../../../../../command/job/patient/api/set-entry-status";
import { BundleType } from "../../../../../bundle/bundle-shared";
import { createOrReplaceBundle as createOrReplaceBundleOnS3 } from "../../../../../bundle/command/create-or-replace-bundle";
import { getBundleByResourceType } from "../../../../../command/get-bundle-by-resource-type";
import { getClientTokenInfo } from "../../../../../command/get-client-token-info";
import { isEhrSourceWithClientCredentials } from "../../../../../environment";
import { buildEhrComputeResourceDiffBundlesHandler } from "../compute/ehr-compute-resource-diff-bundles-factory";
import { EhrRefreshEhrBundlesHandler, RefreshEhrBundlesRequest } from "./ehr-refresh-ehr-bundles";

export class EhrRefreshEhrBundlesDirect implements EhrRefreshEhrBundlesHandler {
  private readonly next = buildEhrComputeResourceDiffBundlesHandler();

  constructor(private readonly waitTimeInMillis: number = 0) {}

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
      let sharedClientTokenInfo: JwtTokenInfo | undefined;
      if (isEhrSourceWithClientCredentials(ehr)) {
        sharedClientTokenInfo = await getClientTokenInfo({
          ehr,
          cxId,
          practiceId,
        });
      }
      await Promise.all([
        getBundleByResourceType({
          ehr,
          ...(sharedClientTokenInfo ? { tokenInfo: sharedClientTokenInfo } : {}),
          cxId,
          practiceId,
          metriportPatientId,
          ehrPatientId,
          resourceType,
          useCachedBundle: false,
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
        await setJobEntryStatus({
          ...entryStatusParams,
          entryStatus: "failed",
        });
      }
      throw error;
    }
    if (this.waitTimeInMillis > 0) await sleep(this.waitTimeInMillis);
  }
}
