import { FhirResource, MetriportError, sleep } from "@metriport/shared";
import {
  fetchEhrBundle as fetchEhrBundleFromApi,
  FetchEhrBundleParams,
} from "../../../../api/fetch-bundle";
import { BundleType } from "../../../bundle-shared";
import { updateBundle as updateBundleOnS3 } from "../../../commands/update-bundle";
import { resourceIsDuplicateOfExistingResources } from "../../utils";
import {
  ComputeResourceDiffBundlesRequest,
  EhrComputeResourceDiffBundlesHandler,
} from "./ehr-compute-resource-diff-bundles";

export class EhrComputeResourceDiffBundlesLocal implements EhrComputeResourceDiffBundlesHandler {
  constructor(private readonly waitTimeInMillis: number) {}

  async computeResourceDiffBundlesMetriportOnly(
    payloads: ComputeResourceDiffBundlesRequest[]
  ): Promise<void> {
    for (const payload of payloads) {
      const {
        ehr,
        cxId,
        practiceId,
        metriportPatientId,
        ehrPatientId,
        existingResources,
        newResource,
      } = payload;
      const resourceType = newResource.resourceType;
      const existingResourcesToUse: FhirResource[] =
        existingResources ??
        (await getExistingResourcesFromApi({
          ehr,
          cxId,
          practiceId,
          patientId: ehrPatientId,
          resourceType,
        }));
      const isDuplicate = resourceIsDuplicateOfExistingResources({
        existingResources: existingResourcesToUse,
        newResource,
      });
      if (!isDuplicate) {
        await updateBundleOnS3({
          ehr,
          cxId,
          metriportPatientId,
          ehrPatientId,
          bundleType: BundleType.RESOURCE_DIFF_METRIPORT_ONLY,
          resource: newResource,
          resourceType,
        });
      }
    }
    if (this.waitTimeInMillis > 0) await sleep(this.waitTimeInMillis);
  }

  async computeResourceDiffBundlesEhrOnly(): Promise<void> {
    throw new MetriportError("Resource diff bundle EhrOnly is not supported");
  }
}

async function getExistingResourcesFromApi({
  ehr,
  cxId,
  practiceId,
  patientId,
  resourceType,
}: Omit<FetchEhrBundleParams, "useCachedBundle">): Promise<FhirResource[]> {
  const existingResourcesBundle = await fetchEhrBundleFromApi({
    ehr,
    cxId,
    practiceId,
    patientId,
    resourceType,
    useCachedBundle: true,
  });
  return existingResourcesBundle.entry.map(entry => entry.resource);
}
