import { EhrSource, FhirResource, sleep, SupportedResourceType } from "@metriport/shared";
import { fetchBundle as fetchBundleFromApi } from "../../../api/fetch-bundle";
import { updateWorkflowTotals } from "../../../api/update-workflow-totals";
import { BundleType } from "../../../bundle/bundle-shared";
import { updateBundle as updateBundleOnS3 } from "../../../bundle/commands/update-bundle";
import { resourceIsDerivedFromExistingResources } from "../../utils";
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
        workflowId,
        requestId,
      } = param;
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
          patientId: metriportPatientId,
          workflowId,
          requestId,
          entryStatus: "successful",
        });
      } catch (error) {
        await updateWorkflowTotals({
          ehr,
          cxId,
          patientId: metriportPatientId,
          workflowId,
          requestId,
          entryStatus: "failed",
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
