import { Resource } from "@medplum/fhirtypes";
import { errorToString, sleep } from "@metriport/shared";
import {
  createBundleFromResourceList,
  SupportedResourceType,
} from "@metriport/shared/interface/external/ehr/fhir-resource";
import { getConsolidated } from "../../../../../../../command/consolidated/consolidated-get";
import { computeResourcesXorAlongResourceType } from "../../../../../../../fhir-deduplication/compute-resources-xor";
import { out } from "../../../../../../../util/log";
import { setCreateResourceDiffBundlesJobEntryStatus } from "../../../../../api/job/create-resource-diff-bundles/set-entry-status";
import { BundleType } from "../../../../bundle-shared";
import { createOrReplaceBundle } from "../../../../command/create-or-replace-bundle";
import { fetchBundle, FetchBundleParams } from "../../../../command/fetch-bundle";
import {
  ComputeResourceDiffBundlesRequest,
  EhrComputeResourceDiffBundlesHandler,
} from "./ehr-compute-resource-diff-bundles";

export class EhrComputeResourceDiffBundlesLocal implements EhrComputeResourceDiffBundlesHandler {
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
        ]);
      } catch (error) {
        out(
          `computeResourceDiffBundles - metriportPatientId ${metriportPatientId} ehrPatientId ${ehrPatientId} resourceType ${resourceType}`
        ).log(`Error creating metriport and ehr bundles. Cause: ${errorToString(error)}`);
      }
      const {
        computedXorTargetResources: metriportResourcesXor,
        computedXorSourceResources: ehrResourcesXor,
      } = computeResourcesXorAlongResourceType({
        targetResources: metriportResources,
        sourceResources: ehrResources,
      });
      await Promise.all([
        ehrResourcesXor.length > 0
          ? createOrReplaceBundle({
              ehr,
              cxId,
              metriportPatientId,
              ehrPatientId,
              bundleType: BundleType.RESOURCE_DIFF_EHR_ONLY,
              bundle: createBundleFromResourceList(ehrResourcesXor),
              resourceType,
              jobId,
            })
          : undefined,
        metriportResourcesXor.length > 0
          ? createOrReplaceBundle({
              ehr,
              cxId,
              metriportPatientId,
              ehrPatientId,
              bundleType: BundleType.RESOURCE_DIFF_METRIPORT_ONLY,
              bundle: createBundleFromResourceList(metriportResourcesXor),
              resourceType,
              jobId,
            })
          : undefined,
      ]);
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

async function getMetriportResourcesFromS3({
  cxId,
  patientId,
  resourceType,
}: {
  cxId: string;
  patientId: string;
  resourceType: SupportedResourceType;
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
