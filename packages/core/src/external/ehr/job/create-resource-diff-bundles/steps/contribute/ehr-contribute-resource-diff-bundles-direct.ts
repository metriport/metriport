import { Resource } from "@medplum/fhirtypes";
import { BadRequestError, sleep } from "@metriport/shared";
import { createBundleFromResourceList } from "@metriport/shared/interface/external/ehr/fhir-resource";
import { EhrSource } from "@metriport/shared/interface/external/ehr/source";
import { getReferencesFromResources } from "../../../../../fhir/shared/bundle";
import { contributeResourceDiffBundle } from "../../../../api/bundle/contribute-resource-diff-bundle";
import { setJobEntryStatus } from "../../../../api/job/set-entry-status";
import { BundleType } from "../../../../bundle/bundle-shared";
import { createOrReplaceBundle } from "../../../../bundle/command/create-or-replace-bundle";
import { fetchBundle, FetchBundleParams } from "../../../../bundle/command/fetch-bundle";
import { getResourceBundleByResourceId } from "../../../../command/ehr-get-resouce-bundle-by-resource-id";
import {
  ContributeResourceDiffBundlesRequest,
  EhrContributeResourceDiffBundlesHandler,
} from "./ehr-contribute-resource-diff-bundles";

const hydrateEhrOnlyResourceRounds = 3;

export class EhrContributeResourceDiffBundlesDirect
  implements EhrContributeResourceDiffBundlesHandler
{
  constructor(private readonly waitTimeInMillis: number) {}

  async contributeResourceDiffBundles(
    payload: ContributeResourceDiffBundlesRequest
  ): Promise<void> {
    const {
      ehr,
      tokenId,
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
        jobId,
      });
      await dangerouslyFetchMissingResources({
        ehr,
        tokenId,
        cxId,
        practiceId,
        metriportPatientId,
        ehrPatientId,
        ehrOnlyResources,
      });
      const validResources = ehrOnlyResources.map(resource =>
        dangerouslyAdjustPatient(resource, metriportPatientId)
      );
      if (validResources.length < 1) {
        throw new BadRequestError(`No valid resources found`, undefined, {
          cxId,
          ehr,
          metriportPatientId,
          ehrPatientId,
          resourceType,
          jobId,
        });
      }
      const dataContributionBundle = createBundleFromResourceList(validResources);
      await createOrReplaceBundle({
        ehr,
        cxId,
        metriportPatientId,
        ehrPatientId,
        bundleType: BundleType.RESOURCE_DIFF_DATA_CONTRIBUTION,
        bundle: dataContributionBundle,
        resourceType,
        jobId,
        mixedResourceTypes: true,
      });
      await contributeResourceDiffBundle({
        ehr,
        cxId,
        patientId: ehrPatientId,
        resourceType,
        jobId,
      });
      await setJobEntryStatus({
        ...entryStatusParams,
        entryStatus: "successful",
      });
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

async function getEhrOnlyResourcesFromS3({
  ehr,
  cxId,
  metriportPatientId,
  ehrPatientId,
  resourceType,
  jobId,
}: Omit<FetchBundleParams, "bundleType">): Promise<Resource[]> {
  const bundle = await fetchBundle({
    ehr,
    cxId,
    metriportPatientId,
    ehrPatientId,
    resourceType,
    bundleType: BundleType.RESOURCE_DIFF_EHR_ONLY,
    jobId,
  });
  if (!bundle?.bundle.entry) return [];
  if (bundle.bundle.entry.length < 1) return [];
  return bundle.bundle.entry.flatMap(entry => {
    if (!entry.resource) return [];
    return [entry.resource];
  });
}

async function dangerouslyFetchMissingResources({
  ehr,
  tokenId,
  cxId,
  practiceId,
  metriportPatientId,
  ehrPatientId,
  ehrOnlyResources,
}: {
  ehr: EhrSource;
  tokenId: string | undefined;
  cxId: string;
  practiceId: string;
  metriportPatientId: string;
  ehrPatientId: string;
  ehrOnlyResources: Resource[];
}): Promise<void> {
  const fetchedResourceIds = new Set<string>([
    ...ehrOnlyResources.flatMap(resource => resource.id ?? []),
  ]);
  for (let i = 0; i < hydrateEhrOnlyResourceRounds; i++) {
    const references = getReferencesFromResources({ resources: ehrOnlyResources });
    if (references.missingReferences.length < 1) break;
    for (const { id, type } of references.missingReferences) {
      if (fetchedResourceIds.has(id)) continue;
      try {
        const bundle = await getResourceBundleByResourceId({
          ehr,
          ...(tokenId && { tokenId }),
          cxId,
          practiceId,
          metriportPatientId,
          ehrPatientId,
          resourceType: type,
          resourceId: id,
          useCachedBundle: true,
        });
        fetchedResourceIds.add(id);
        const resource = bundle.entry?.[0]?.resource;
        if (!resource) continue;
        ehrOnlyResources.push(resource);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (error: any) {
        if (error instanceof BadRequestError && error.message === "Invalid resource type") {
          continue;
        }
        throw error;
      }
    }
  }
}

function dangerouslyAdjustPatient(resource: Resource, metriportPatientId: string): Resource {
  if (resource.resourceType === "Patient") {
    resource.id = metriportPatientId;
  }
  if ("subject" in resource) {
    const subject = resource.subject;
    if ("reference" in subject) {
      subject.reference = `Patient/${metriportPatientId}`;
    }
  }
  if ("patient" in resource) {
    resource.patient.reference = `Patient/${metriportPatientId}`;
  }
  return resource;
}
