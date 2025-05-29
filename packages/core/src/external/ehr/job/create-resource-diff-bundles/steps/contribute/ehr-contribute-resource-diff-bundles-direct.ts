import { Bundle, Resource } from "@medplum/fhirtypes";
import { BadRequestError, sleep } from "@metriport/shared";
import { createBundleFromResourceList } from "@metriport/shared/interface/external/ehr/fhir-resource";
import { EhrSource, EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { getReferencesFromResources } from "../../../../../fhir/shared/bundle";
import { contributeResourceDiffBundle } from "../../../../api/bundle/contribute-resource-diff-bundle";
import { setJobEntryStatus } from "../../../../api/job/set-entry-status";
import { getResourceBundleByResourceId as getAthenaResourceBundleByResourceId } from "../../../../athenahealth/command/get-resource-bundle-by-resource-id";
import { BundleType } from "../../../../bundle/bundle-shared";
import { createOrReplaceBundle } from "../../../../bundle/command/create-or-replace-bundle";
import { fetchBundle, FetchBundleParams } from "../../../../bundle/command/fetch-bundle";
import { getResourceBundleByResourceId as getCanvasResourceBundleByResourceId } from "../../../../canvas/command/get-resource-bundle-by-resource-id";
import { GetResourceBundleByResourceIdParams } from "../../../../shared";
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
      const references = getReferencesFromResources({ resources: ehrOnlyResources });
      const getResourceBundleByResourceId = getEhrResourceBundleByResourceId(ehr);
      for (const { id, type } of references.missingReferences) {
        try {
          const bundle = await getResourceBundleByResourceId({
            ...(tokenId && { tokenId }),
            cxId,
            practiceId,
            metriportPatientId,
            ehrPatientId,
            resourceType: type,
            resourceId: id,
            useCachedBundle: true,
          });
          const resource = bundle.entry?.[0]?.resource;
          if (!resource) continue;
          ehrOnlyResources.push(resource);
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } catch (error: any) {
          if (error.message === "Invalid resource type") continue;
          throw error;
        }
      }
      const validResources = ehrOnlyResources.map(resource =>
        adjustPatientDangerous(resource, metriportPatientId)
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

type GetResourceBundleByResourceId = (
  params: GetResourceBundleByResourceIdParams
) => Promise<Bundle>;

const ehrGetResourceBundleByResourceIdMap: Record<
  EhrSource,
  GetResourceBundleByResourceId | undefined
> = {
  [EhrSources.athena]: getAthenaResourceBundleByResourceId,
  [EhrSources.elation]: undefined,
  [EhrSources.healthie]: undefined,
  [EhrSources.canvas]: getCanvasResourceBundleByResourceId,
  [EhrSources.eclinicalworks]: undefined,
};

function getEhrResourceBundleByResourceId(ehr: EhrSource): GetResourceBundleByResourceId {
  const handler = ehrGetResourceBundleByResourceIdMap[ehr];
  if (!handler) {
    throw new BadRequestError(`No get resource bundle by resource id handler found`, undefined, {
      ehr,
    });
  }
  return handler;
}

function adjustPatientDangerous(resource: Resource, metriportPatientId: string): Resource {
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
