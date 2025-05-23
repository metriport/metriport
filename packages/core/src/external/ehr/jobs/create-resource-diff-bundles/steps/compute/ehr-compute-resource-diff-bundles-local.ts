import { Resource } from "@medplum/fhirtypes";
import { errorToString, sleep } from "@metriport/shared";
import { createBundleFromResourceList } from "@metriport/shared/interface/external/ehr/fhir-resource";
import { getConsolidated } from "../../../../../../command/consolidated/consolidated-get";
import { computeResourcesXorAlongResourceType } from "../../../../../../fhir-deduplication/compute-resources-xor";
import { deduplicateResources } from "../../../../../../fhir-deduplication/dedup-resources";
import { out } from "../../../../../../util/log";
import { setCreateResourceDiffBundlesJobEntryStatus } from "../../../../api/job/create-resource-diff-bundles/set-entry-status";
import { BundleType } from "../../../../bundle/bundle-shared";
import { createOrReplaceBundle } from "../../../../bundle/command/create-or-replace-bundle";
import { fetchBundle, FetchBundleParams } from "../../../../bundle/command/fetch-bundle";
import { buildEhrContributeResourceDiffBundlesHandler } from "../contribute/ehr-contribute-resource-diff-bundles-factory";
import {
  ComputeResourceDiffBundlesRequest,
  EhrComputeResourceDiffBundlesHandler,
} from "./ehr-compute-resource-diff-bundles";

export class EhrComputeResourceDiffBundlesLocal implements EhrComputeResourceDiffBundlesHandler {
  private readonly next = buildEhrContributeResourceDiffBundlesHandler();

  constructor(private readonly waitTimeInMillis: number) {}

  async computeResourceDiffBundles(payload: ComputeResourceDiffBundlesRequest): Promise<void> {
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
      const [metriportResources, ehrResources] = await Promise.all([
        getMetriportResourcesFromS3({
          cxId,
          patientId: metriportPatientId,
          resourceType,
        }),
        getEhrResourcesFromS3({
          ehr,
          cxId,
          metriportPatientId,
          ehrPatientId,
          resourceType,
        }),
      ]);
      const dedupedEhrResources = deduplicateResources<Resource>({ resources: ehrResources });
      try {
        await Promise.all([
          createOrReplaceBundle({
            ehr,
            cxId,
            metriportPatientId,
            ehrPatientId,
            bundleType: BundleType.METRIPORT,
            bundle: createBundleFromResourceList(metriportResources),
            resourceType,
            jobId,
          }),
          createOrReplaceBundle({
            ehr,
            cxId,
            metriportPatientId,
            ehrPatientId,
            bundleType: BundleType.EHR,
            bundle: createBundleFromResourceList(ehrResources),
            resourceType,
            jobId,
          }),
          createOrReplaceBundle({
            ehr,
            cxId,
            metriportPatientId,
            ehrPatientId,
            bundleType: BundleType.EHR_DEDUPED,
            bundle: createBundleFromResourceList(dedupedEhrResources),
            resourceType,
            jobId,
          }),
        ]);
      } catch (error) {
        out(
          `computeResourceDiffBundles - metriportPatientId ${metriportPatientId} ehrPatientId ${ehrPatientId} resourceType ${resourceType}`
        ).log(`Error creating metriport and ehr bundles. Cause: ${errorToString(error)}`);
      }
      const { targetOnly: metriportOnly, sourceOnly: ehrOnly } =
        computeResourcesXorAlongResourceType({
          targetResources: metriportResources,
          sourceResources: dedupedEhrResources,
        });
      await Promise.all([
        ehrOnly.length > 0
          ? createOrReplaceBundle({
              ehr,
              cxId,
              metriportPatientId,
              ehrPatientId,
              bundleType: BundleType.RESOURCE_DIFF_EHR_ONLY,
              bundle: createBundleFromResourceList(ehrOnly),
              resourceType,
              jobId,
            })
          : undefined,
        metriportOnly.length > 0
          ? createOrReplaceBundle({
              ehr,
              cxId,
              metriportPatientId,
              ehrPatientId,
              bundleType: BundleType.RESOURCE_DIFF_METRIPORT_ONLY,
              bundle: createBundleFromResourceList(metriportOnly),
              resourceType,
              jobId,
            })
          : undefined,
      ]);
      await this.next.contributeResourceDiffBundles(payload);
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

async function getMetriportResourcesFromS3({
  cxId,
  patientId,
  resourceType,
}: {
  cxId: string;
  patientId: string;
  resourceType: string;
}): Promise<Resource[]> {
  const consolidated = await getConsolidated({ cxId, patientId });
  if (!consolidated?.bundle?.entry) return [];
  const resources = consolidated.bundle.entry.filter(
    entry => entry.resource?.resourceType === resourceType
  );
  if (resources.length < 1) return [];
  return resources.flatMap(entry => {
    if (!entry.resource) return [];
    return [entry.resource];
  });
}

async function getEhrResourcesFromS3({
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
    bundleType: BundleType.EHR,
  });
  if (!bundle?.bundle.entry) return [];
  if (bundle.bundle.entry.length < 1) return [];
  return bundle.bundle.entry.flatMap(entry => {
    if (!entry.resource) return [];
    return [entry.resource];
  });
}
