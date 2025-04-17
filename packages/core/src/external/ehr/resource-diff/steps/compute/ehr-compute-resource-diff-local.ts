import { EhrSource, FhirResource, sleep, SupportedResourceType } from "@metriport/shared";
import { fetchBundle as fetchBundleFromApi } from "../../../api/fetch-bundle";
import { BundleType } from "../../../bundle/bundle-shared";
import { updateBundle as updateBundleOnS3 } from "../../../bundle/commands/update-bundle";
import { computeResourceDiff } from "../../utils";
import {
  ComputeResourceDiffRequests,
  EhrComputeResourceDiffHandler,
} from "./ehr-compute-resource-diff";

export class EhrComputeResourceDiffLocal implements EhrComputeResourceDiffHandler {
  constructor(private readonly waitTimeInMillis: number) {}

  async computeResourceDiff(params: ComputeResourceDiffRequests): Promise<void> {
    for (const param of params) {
      const {
        ehr,
        cxId,
        practiceId,
        metriportPatientId,
        ehrPatientId,
        existingResources,
        newResource,
      } = param;
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
      const matchedResourceIds = computeResourceDiff({
        existingResources: existingResourcesToUse,
        newResource,
      });
      if (matchedResourceIds.length > 0) {
        await updateBundleOnS3({
          ehr,
          cxId,
          metriportPatientId,
          ehrPatientId,
          bundleType: BundleType.METRIPORT_ONLY,
          resource: newResource,
          resourceType,
        });
      }
    }
    if (this.waitTimeInMillis > 0) await sleep(this.waitTimeInMillis);
  }
}

async function getExistingResourcesFromApi({
  ehr,
  cxId,
  practiceId,
  patientId,
  resourceType,
}: {
  ehr: EhrSource;
  cxId: string;
  patientId: string;
  practiceId: string;
  resourceType: SupportedResourceType;
}): Promise<FhirResource[]> {
  const existingResourcesBundle = await fetchBundleFromApi({
    ehr,
    cxId,
    practiceId,
    patientId,
    resourceType,
    useExistingBundle: true,
  });
  return existingResourcesBundle.entry.map(entry => entry.resource);
}
