import { Bundle, Resource } from "@medplum/fhirtypes";
import { BadRequestError, sleep } from "@metriport/shared";
import { createBundleFromResourceList } from "@metriport/shared/interface/external/ehr/fhir-resource";
import { EhrSource, EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { isValidUuid } from "../../../../../../util/uuid-v7";
import { getReferencesFromResources } from "../../../../../fhir/shared/bundle";
import { contributeResourceDiffBundle } from "../../../../api/bundle/contribute-resource-diff-bundle";
import { setCreateResourceDiffBundlesJobEntryStatus } from "../../../../api/job/create-resource-diff-bundles/set-entry-status";
import { getResourceBundleByResourceId as getAthenaResourceBundleByResourceId } from "../../../../athenahealth/command/get-resource-bundle-by-resource-id";
import { BundleType } from "../../../../bundle/bundle-shared";
import { createOrReplaceBundle } from "../../../../bundle/command/create-or-replace-bundle";
import { fetchBundle, FetchBundleParams } from "../../../../bundle/command/fetch-bundle";
import { getResourceBundleByResourceId as getCanvasResourceBundleByResourceId } from "../../../../canvas/command/get-resource-bundle-by-resource-id";
import { GetResourceBundleByResourceParams } from "../../../../shared";
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
      const references = getReferencesFromResources({ resources: ehrOnlyResources });
      const getResourceBundleByResourceId = getEhrResourceBundleByResourceId(ehr);
      for (const { id, type } of references.missingReferences) {
        const resource = await getResourceBundleByResourceId({
          cxId,
          practiceId,
          metriportPatientId,
          ehrPatientId,
          resourceType: type,
          resourceId: id,
        });
        if (!resource) continue;
        ehrOnlyResources.push(resource);
      }
      const validResources = ehrOnlyResources
        .map(resource => adjustPatient(resource, metriportPatientId))
        .filter(resource => isValidUuid(resource.id ?? ""));
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

type GetResourceBundleByResourceId = (
  params: GetResourceBundleByResourceParams
) => Promise<Bundle | undefined>;

export const ehrGetResourceBundleByResourceIdMap: Record<
  EhrSource,
  GetResourceBundleByResourceId | undefined
> = {
  [EhrSources.athena]: getAthenaResourceBundleByResourceId,
  [EhrSources.elation]: undefined,
  [EhrSources.healthie]: undefined,
  [EhrSources.canvas]: getCanvasResourceBundleByResourceId,
  [EhrSources.eclinicalworks]: undefined,
};

export function getEhrResourceBundleByResourceId(ehr: EhrSource): GetResourceBundleByResourceId {
  const handler = ehrGetResourceBundleByResourceIdMap[ehr];
  if (!handler) {
    throw new BadRequestError(`No get resource bundle by resource id handler found`, undefined, {
      ehr,
    });
  }
  return handler;
}

function adjustPatient(resource: Resource, metriportPatientId: string): Resource {
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
