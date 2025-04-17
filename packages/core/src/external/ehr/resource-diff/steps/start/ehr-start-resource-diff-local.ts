import { sleep } from "@metriport/shared";
import {
  Bundle,
  fhirResourceSchema,
  SupportedResourceType,
} from "@metriport/shared/interface/external/ehr/fhir-resource";
import { getConsolidated } from "../../../../../command/consolidated/consolidated-get";
import { fetchBundle as fetchBundleFromApi } from "../../../api/fetch-bundle";
import { updateWorkflowTracking } from "../../../api/update-workflow-tracking";
import { getSupportedResourcesByEhr } from "../../../bundle/bundle-shared";
import { buildEhrComputeResourceDiffHandler } from "../compute/ehr-compute-resource-diff-factory";
import { EhrStartResourceDiffHandler, StartResourceDiffRequest } from "./ehr-start-resource-diff";

export class EhrStartResourceDiffLocal implements EhrStartResourceDiffHandler {
  private readonly fetchedBundles: Map<string, Bundle>;
  private readonly next = buildEhrComputeResourceDiffHandler();

  constructor(private readonly waitTimeInMillis: number) {
    this.fetchedBundles = new Map();
  }

  async startResourceDiff({
    ehr,
    cxId,
    practiceId,
    metriportPatientId,
    ehrPatientId,
    requestId,
    workflowId,
  }: StartResourceDiffRequest): Promise<void> {
    const consolidated = await getConsolidated({ cxId, patientId: metriportPatientId });
    if (!consolidated || !consolidated.bundle?.entry || consolidated.bundle.entry.length < 1) {
      return;
    }
    const resourceTypes = new Set<SupportedResourceType>();
    const computeResourceDiffParams = consolidated.bundle.entry.flatMap(bundleEntry => {
      if (!bundleEntry.resource) return [];
      const newResourceSafeParsed = fhirResourceSchema.safeParse(bundleEntry.resource);
      if (!newResourceSafeParsed.success) return [];
      const newResource = newResourceSafeParsed.data;
      const supportedResources = getSupportedResourcesByEhr(ehr);
      if (!supportedResources.includes(newResource.resourceType)) return [];
      resourceTypes.add(newResource.resourceType);
      return [
        {
          ehr,
          cxId,
          practiceId,
          metriportPatientId,
          ehrPatientId,
          newResource,
          workflowId,
          requestId,
        },
      ];
    });
    for (const resourceType of resourceTypes) {
      const existingResourcesBundle = await fetchBundleFromApi({
        ehr,
        cxId,
        practiceId,
        patientId: ehrPatientId,
        resourceType,
        useExistingBundle: false,
      });
      if (existingResourcesBundle.entry.length < 1) continue;
      this.fetchedBundles.set(resourceType, existingResourcesBundle);
    }
    const computeResourceDiffParamsWithExistingResources = computeResourceDiffParams.flatMap(
      param => {
        const existingResourcesBundle = this.fetchedBundles.get(param.newResource.resourceType);
        if (!existingResourcesBundle) return [];
        const existingResources = existingResourcesBundle.entry.map(entry => entry.resource);
        return [{ ...param, existingResources }];
      }
    );
    await updateWorkflowTracking({
      ehr,
      cxId,
      patientId: metriportPatientId,
      workflowId,
      requestId,
      total: computeResourceDiffParamsWithExistingResources.length,
    });
    await this.next.computeResourceDiff(computeResourceDiffParamsWithExistingResources);
    if (this.waitTimeInMillis > 0) await sleep(this.waitTimeInMillis);
  }
}
