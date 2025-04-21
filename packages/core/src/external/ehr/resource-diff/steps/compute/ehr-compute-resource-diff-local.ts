import { FhirResource, sleep } from "@metriport/shared";
import { fetchBundle as fetchBundleFromApi, FetchBundleParams } from "../../../api/fetch-bundle";
import { updateWorkflowTotals } from "../../../api/update-workflow-totals";
import { BundleType } from "../../../bundle/bundle-shared";
import { updateBundle as updateBundleOnS3 } from "../../../bundle/commands/update-bundle";
import { resourceIsDerivedFromExistingResources } from "../../utils";
import {
  ComputeResourceDiffRequest,
  EhrComputeResourceDiffHandler,
} from "./ehr-compute-resource-diff";

export class EhrComputeResourceDiffLocal implements EhrComputeResourceDiffHandler {
  constructor(private readonly waitTimeInMillis: number) {}

  async computeResourceDiff(payloads: ComputeResourceDiffRequest[]): Promise<void> {
    for (const payload of payloads) {
      const {
        ehr,
        cxId,
        practiceId,
        metriportPatientId,
        ehrPatientId,
        existingResources,
        newResource,
        workflowId,
        requestId,
      } = payload;
      try {
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
        const isDerived = resourceIsDerivedFromExistingResources({
          existingResources: existingResourcesToUse,
          newResource,
        });
        if (!isDerived) {
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
        await updateWorkflowTotals({
          ehr,
          cxId,
          metriportPatientId,
          workflowId,
          requestId,
          entryStatus: "successful",
        });
      } catch (error) {
        await updateWorkflowTotals({
          ehr,
          cxId,
          metriportPatientId,
          workflowId,
          requestId,
          entryStatus: "failed",
        });
      }
    }
    if (this.waitTimeInMillis > 0) await sleep(this.waitTimeInMillis);
  }
}

async function getExistingResourcesFromApi(
  params: Omit<FetchBundleParams, "useCachedBundle">
): Promise<FhirResource[]> {
  const existingResourcesBundle = await fetchBundleFromApi({ ...params, useCachedBundle: true });
  return existingResourcesBundle.entry.map(entry => entry.resource);
}
