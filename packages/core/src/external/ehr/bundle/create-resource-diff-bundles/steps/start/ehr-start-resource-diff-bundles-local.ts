import { sleep } from "@metriport/shared";
import { getDefaultBundle } from "@metriport/shared/interface/external/ehr/fhir-resource";
import { ResourceDiffDirection } from "@metriport/shared/interface/external/ehr/resource-diff";
import { completeJob } from "../../../../api/complete-job";
import { fetchEhrBundlePreSignedUrls as fetchEhrBundlePreSignedUrlsFromApi } from "../../../../api/fetch-bundle-presigned-url";
import { initializeJob } from "../../../../api/initialize-job";
import { updateJobTotal } from "../../../../api/update-job-total";
import { BundleType, getSupportedResourcesByEhr } from "../../../bundle-shared";
import { createOrReplaceBundle as createOrReplaceBundleOnS3 } from "../../../commands/create-or-replace-bundle";
import { ComputeResourceDiffBundlesRequest } from "../compute/ehr-compute-resource-diff-bundles";
import { buildEhrComputeResourceDiffBundlesHandler } from "../compute/ehr-compute-resource-diff-bundles-factory";
import {
  EhrStartResourceDiffBundlesHandler,
  StartResourceDiffBundlesRequest,
} from "./ehr-start-resource-diff-bundles";

export class EhrStartResourceDiffBundlesLocal implements EhrStartResourceDiffBundlesHandler {
  private readonly next = buildEhrComputeResourceDiffBundlesHandler();

  constructor(private readonly waitTimeInMillis: number) {}

  async startResourceDiffBundles(payload: StartResourceDiffBundlesRequest): Promise<void> {
    const { ehr, cxId, practiceId, metriportPatientId, ehrPatientId, jobId, direction } = payload;
    await initializeJob({ cxId, jobId });
    const supportedResources = getSupportedResourcesByEhr(ehr);
    const totalResources = supportedResources.length;
    if (totalResources === 0) {
      await completeJob({ cxId, jobId });
      return;
    }
    await updateJobTotal({ cxId, jobId, total: totalResources });
    const computeResourceDiffParams: ComputeResourceDiffBundlesRequest[] = [];
    for (const resourceType of supportedResources) {
      await Promise.all([
        direction === ResourceDiffDirection.METRIPORT_ONLY
          ? fetchEhrBundlePreSignedUrlsFromApi({
              ehr,
              cxId,
              practiceId,
              patientId: ehrPatientId,
              resourceType,
              refresh: true,
            })
          : undefined,
        createOrReplaceBundleOnS3({
          ehr,
          cxId,
          metriportPatientId,
          ehrPatientId,
          bundleType:
            direction === ResourceDiffDirection.METRIPORT_ONLY
              ? BundleType.RESOURCE_DIFF_METRIPORT_ONLY
              : BundleType.RESOURCE_DIFF_EHR_ONLY,
          bundle: getDefaultBundle(),
          resourceType,
          jobId,
        }),
      ]);
      computeResourceDiffParams.push({ ...payload, resourceType });
    }
    await this.next.computeResourceDiffBundles(computeResourceDiffParams);
    if (this.waitTimeInMillis > 0) await sleep(this.waitTimeInMillis);
  }
}
