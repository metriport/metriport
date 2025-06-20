import { Resource } from "@medplum/fhirtypes";
import { BadRequestError, NotFoundError, sleep } from "@metriport/shared";
import { createUuidFromText } from "@metriport/shared/common/uuid";
import { createBundleFromResourceList } from "@metriport/shared/interface/external/ehr/fhir-resource";
import { EhrSource } from "@metriport/shared/interface/external/ehr/source";
import { setJobEntryStatus } from "../../../../../../command/job/patient/api/set-entry-status";
import { getReferencesFromResources } from "../../../../../fhir/bundle/bundle";
import { createPredecessorExtensionRelatedArtifact } from "../../../../../fhir/shared/extensions/derived-from";
import { createExtensionDataSource } from "../../../../../fhir/shared/extensions/extension";
import { contributeResourceDiffBundle } from "../../../../api/bundle/contribute-resource-diff-bundle";
import { BundleType } from "../../../../bundle/bundle-shared";
import { createOrReplaceBundle } from "../../../../bundle/command/create-or-replace-bundle";
import { fetchBundle, FetchBundleParams } from "../../../../bundle/command/fetch-bundle";
import { getResourceBundleByResourceId } from "../../../../command/get-resource-bundle-by-resource-id";
import {
  ContributeResourceDiffBundlesRequest,
  EhrContributeResourceDiffBundlesHandler,
} from "./ehr-contribute-resource-diff-bundles";

const hydrateEhrOnlyResourceAttempts = 3;

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
      if (ehrOnlyResources.length < 1) return;
      const hydratedEhrOnlyResources = await hydrateEhrOnlyResources({
        ehr,
        tokenId,
        cxId,
        practiceId,
        metriportPatientId,
        ehrPatientId,
        ehrOnlyResources,
      });
      const preparedAndHydratedEhrOnlyResources = prepareEhrOnlyResourcesForContribution(
        hydratedEhrOnlyResources,
        metriportPatientId,
        ehr
      );
      const dataContributionBundle = createBundleFromResourceList(
        preparedAndHydratedEhrOnlyResources
      );
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
  if (!bundle?.bundle.entry || bundle.bundle.entry.length < 1) return [];
  return bundle.bundle.entry.flatMap(entry => {
    if (!entry.resource) return [];
    return [entry.resource];
  });
}

async function hydrateEhrOnlyResources({
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
}): Promise<Resource[]> {
  const hydratedEhrOnlyResources = [...ehrOnlyResources];
  const fetchedResourceIds = new Set<string>([
    ...hydratedEhrOnlyResources.flatMap(resource => resource.id ?? []),
  ]);
  for (let i = 0; i < hydrateEhrOnlyResourceAttempts; i++) {
    const { missingReferences } = getReferencesFromResources({
      resourcesToCheckRefs: hydratedEhrOnlyResources,
    });
    if (missingReferences.length < 1) break;
    for (const { id, type } of missingReferences) {
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
        const resource = bundle.entry?.[0]?.resource;
        if (!resource) continue;
        hydratedEhrOnlyResources.push(resource);
      } catch (error) {
        if (error instanceof BadRequestError || error instanceof NotFoundError) continue;
        throw error;
      } finally {
        fetchedResourceIds.add(id);
      }
    }
  }
  return hydratedEhrOnlyResources;
}

function prepareEhrOnlyResourcesForContribution(
  ehrOnlyResources: Resource[],
  metriportPatientId: string,
  ehr: EhrSource
): Resource[] {
  let preparedEhrOnlyResources: Resource[] = [...ehrOnlyResources];
  const resourceIdMap = new Map<string, string>();
  for (const resource of ehrOnlyResources) {
    if (!resource.id) continue;
    const oldResourceId = resource.id;
    const newResourceId =
      resource.resourceType === "Patient"
        ? metriportPatientId
        : createUuidFromText(`${ehr}_${oldResourceId}`);
    resourceIdMap.set(newResourceId, oldResourceId);
    preparedEhrOnlyResources = replaceResourceId(
      preparedEhrOnlyResources,
      oldResourceId,
      newResourceId
    );
  }
  for (const resource of preparedEhrOnlyResources) {
    if (!resource.id) continue;
    const newResourceId = resource.id;
    const oldResourceId = resourceIdMap.get(newResourceId);
    if (!oldResourceId) continue;
    dangerouslyAdjustPatientReference(resource, metriportPatientId);
    dangerouslyAdjustExtensions(resource, oldResourceId, ehr);
  }
  return preparedEhrOnlyResources;
}

function dangerouslyAdjustPatientReference(resource: Resource, metriportPatientId: string) {
  const patientReference = { reference: `Patient/${metriportPatientId}` };
  if ("subject" in resource) resource.subject = patientReference;
  if ("patient" in resource) resource.patient = patientReference;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function dangerouslyAdjustExtensions(resource: any, predecessorId: string, ehr: EhrSource) {
  const predecessorExtension = createPredecessorExtensionRelatedArtifact(predecessorId);
  const dataSourceExtension = createExtensionDataSource(ehr.toUpperCase());
  resource.extension = [...(resource.extension ?? []), predecessorExtension, dataSourceExtension];
}

function replaceResourceId(
  resources: Resource[],
  oldResourceId: string,
  newResourceId: string
): Resource[] {
  const resourcesAsString = JSON.stringify(resources);
  const resourcesAsStringWithReplacedId = resourcesAsString.replace(
    `/${oldResourceId}/g`,
    newResourceId
  );
  return JSON.parse(resourcesAsStringWithReplacedId);
}
