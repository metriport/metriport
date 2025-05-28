import { Resource } from "@medplum/fhirtypes";
import { sleep } from "@metriport/shared";
import { createBundleFromResourceList } from "@metriport/shared/interface/external/ehr/fhir-resource";
import { contributeResourceDiffBundle } from "../../../../api/bundle/contribute-resource-diff-bundle";
import { setCreateResourceDiffBundlesJobEntryStatus } from "../../../../api/job/create-resource-diff-bundles/set-entry-status";
import { BundleType } from "../../../../bundle/bundle-shared";
import { createOrReplaceBundle } from "../../../../bundle/command/create-or-replace-bundle";
import { fetchBundle, FetchBundleParams } from "../../../../bundle/command/fetch-bundle";
import {
  ContributeResourceDiffBundlesRequest,
  EhrContributeResourceDiffBundlesHandler,
} from "./ehr-contribute-resource-diff-bundles";

export class EhrContributeResourceDiffBundlesDirect
  implements EhrContributeResourceDiffBundlesHandler
{
  constructor(private readonly waitTimeInMillis: number) {}

  async contributeResourceDiffBundles(
    payload: ContributeResourceDiffBundlesRequest
  ): Promise<void> {
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
      const ehrOnlyResources = await getEhrOnlyResourcesFromS3({
        ehr,
        cxId,
        metriportPatientId,
        ehrPatientId,
        resourceType,
      });
      const dataContributionBundle = createBundleFromResourceList(ehrOnlyResources);
      await createOrReplaceBundle({
        ehr,
        cxId,
        metriportPatientId,
        ehrPatientId,
        bundleType: BundleType.RESOURCE_DIFF_DATA_CONTRIBUTION,
        bundle: dataContributionBundle,
        resourceType,
        jobId,
      });
      await contributeResourceDiffBundle({
        ehr,
        cxId,
        patientId: ehrPatientId,
        resourceType,
        jobId,
      });
      await setCreateResourceDiffBundlesJobEntryStatus({
        ...entryStatusParams,
        entryStatus: "successful",
      });
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

async function getEhrOnlyResourcesFromS3({
  ehr,
  cxId,
  metriportPatientId,
  ehrPatientId,
  resourceType,
}: Omit<FetchBundleParams, "bundleType">): Promise<Resource[]> {
  const bundle = await fetchBundle({
    ehr,
    cxId,
    metriportPatientId,
    ehrPatientId,
    resourceType,
    bundleType: BundleType.RESOURCE_DIFF_EHR_ONLY,
  });
  if (!bundle?.bundle.entry) return [];
  if (bundle.bundle.entry.length < 1) return [];
  return bundle.bundle.entry.flatMap(entry => {
    if (!entry.resource) return [];
    return [entry.resource];
  });
}
