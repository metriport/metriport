import {
  Bundle,
  FhirResource,
  MetriportError,
  sleep,
  SupportedResourceType,
} from "@metriport/shared";
import { ResourceDiffDirection } from "@metriport/shared/interface/external/ehr/resource-diff";
import axios from "axios";
import { getConsolidated } from "../../../../../../command/consolidated/consolidated-get";
import {
  FetchEhrBundleParams,
  fetchEhrBundlePreSignedUrls as fetchEhrBundlePreSignedUrlsFromApi,
} from "../../../../api/fetch-bundle-presigned-url";
import {
  setEhrOnlyResourceDiffJobEntryStatus,
  SetEhrOnlyResourceDiffJobEntryStatusParams,
} from "../../../../api/job/ehr-only-set-entry-status";
import { setJobEntryStatus } from "../../../../api/job/set-entry-status";
import { BundleType } from "../../../bundle-shared";
import { updateBundle as updateBundleOnS3 } from "../../../commands/update-bundle";
import { computeNewResources } from "../../utils";
import {
  ComputeResourceDiffBundlesRequest,
  EhrComputeResourceDiffBundlesHandler,
} from "./ehr-compute-resource-diff-bundles";

export class EhrComputeResourceDiffBundlesLocal implements EhrComputeResourceDiffBundlesHandler {
  constructor(private readonly waitTimeInMillis: number) {}

  async computeResourceDiffBundles(payloads: ComputeResourceDiffBundlesRequest[]): Promise<void> {
    for (const payload of payloads) {
      const {
        ehr,
        cxId,
        practiceId,
        metriportPatientId,
        ehrPatientId,
        resourceType,
        direction,
        jobId,
      } = payload;
      const entryStatusParams = {
        ehr,
        cxId,
        practiceId,
        patientId: ehrPatientId,
        direction,
        jobId,
      };
      try {
        const [metriportResources, ehrResources] = await Promise.all([
          getMetriportResourcesFromS3({
            cxId,
            patientId: metriportPatientId,
            resourceType,
          }),
          getEhrResourcesFromApi({
            ehr,
            cxId,
            practiceId,
            patientId: ehrPatientId,
            resourceType,
          }),
        ]);
        const newResources = await getNewResources({
          direction,
          metriportResources,
          ehrResources,
        });
        if (newResources.length > 0) {
          await updateBundleOnS3({
            ehr,
            cxId,
            metriportPatientId,
            ehrPatientId,
            bundleType:
              direction === ResourceDiffDirection.METRIPORT_ONLY
                ? BundleType.RESOURCE_DIFF_METRIPORT_ONLY
                : BundleType.RESOURCE_DIFF_EHR_ONLY,
            resources: newResources,
            resourceType,
            jobId,
          });
        }
        await setJobEntryStatusFromDirection({ ...entryStatusParams, entryStatus: "successful" });
      } catch (error) {
        await setJobEntryStatusFromDirection({ ...entryStatusParams, entryStatus: "failed" });
        throw error;
      }
    }
    if (this.waitTimeInMillis > 0) await sleep(this.waitTimeInMillis);
  }
}

async function getNewResources({
  direction,
  metriportResources,
  ehrResources,
}: {
  direction: ResourceDiffDirection;
  metriportResources: FhirResource[];
  ehrResources: FhirResource[];
}): Promise<FhirResource[]> {
  if (direction === ResourceDiffDirection.METRIPORT_ONLY) {
    return computeNewResources({
      existingResources: metriportResources,
      testResources: ehrResources,
    });
  } else {
    return computeNewResources({
      existingResources: ehrResources,
      testResources: metriportResources,
    });
  }
}

async function setJobEntryStatusFromDirection({
  ehr,
  cxId,
  practiceId,
  patientId,
  jobId,
  entryStatus,
  direction,
}: SetEhrOnlyResourceDiffJobEntryStatusParams & {
  direction: ResourceDiffDirection;
}): Promise<void> {
  if (direction === ResourceDiffDirection.METRIPORT_ONLY) {
    await setJobEntryStatus({ cxId, jobId, entryStatus });
  } else {
    await setEhrOnlyResourceDiffJobEntryStatus({
      cxId,
      jobId,
      entryStatus,
      ehr,
      practiceId,
      patientId,
    });
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
}): Promise<FhirResource[]> {
  const consolidated = await getConsolidated({ cxId, patientId });
  const resources = consolidated?.bundle?.entry?.filter(
    entry => entry.resource?.resourceType === resourceType
  );
  if (!resources || resources.length < 1) return [];
  return resources.map(entry => entry.resource as FhirResource);
}

async function getEhrResourcesFromApi({
  ehr,
  cxId,
  practiceId,
  patientId,
  resourceType,
}: Omit<FetchEhrBundleParams, "refresh">): Promise<FhirResource[]> {
  const ehrResourcesBundle = await fetchEhrBundlePreSignedUrlsFromApi({
    ehr,
    cxId,
    practiceId,
    patientId,
    resourceType,
    refresh: false,
  });
  const fetchedResourceType = ehrResourcesBundle.resourceTypes[0];
  const fetchedPreSignedUrls = ehrResourcesBundle.preSignedUrls[0];
  if (!fetchedResourceType || !fetchedPreSignedUrls) {
    throw new MetriportError("More than one resource type found in the EHR bundle", undefined, {
      ehr,
      cxId,
      practiceId,
      patientId,
      resourceType,
    });
  }
  const ehrResource = await axios.get(fetchedPreSignedUrls);
  const bundle: Bundle = ehrResource.data;
  return bundle.entry.map(entry => entry.resource);
}
