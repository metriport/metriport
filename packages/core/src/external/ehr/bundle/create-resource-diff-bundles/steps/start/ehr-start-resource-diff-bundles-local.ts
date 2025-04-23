import { MetriportError, sleep } from "@metriport/shared";
import {
  Bundle,
  fhirResourceSchema,
  getDefaultBundle,
  SupportedResourceType,
} from "@metriport/shared/interface/external/ehr/fhir-resource";
import { getConsolidated } from "../../../../../../command/consolidated/consolidated-get";
import { fetchEhrBundle as fetchEhrBundleFromApi } from "../../../../api/fetch-bundle";
import { updateWorkflowTracking } from "../../../../api/update-workflow-tracking";
import { BundleType, getSupportedResourcesByEhr } from "../../../bundle-shared";
import { createOrReplaceBundle as createOrReplaceBundleOnS3 } from "../../../commands/create-or-replace-bundle";
import { buildEhrComputeResourceDiffBundlesHandler } from "../compute/ehr-compute-resource-diff-bundles-factory";
import {
  EhrStartResourceDiffBundlesHandler,
  StartResourceDiffBundlesRequest,
} from "./ehr-start-resource-diff-bundles";

export class EhrStartResourceDiffBundlesLocal implements EhrStartResourceDiffBundlesHandler {
  private readonly fetchedBundles: Map<string, Bundle>;
  private readonly next = buildEhrComputeResourceDiffBundlesHandler();

  constructor(private readonly waitTimeInMillis: number) {
    this.fetchedBundles = new Map();
  }

  async startResourceDiffBundlesMetriportOnly({
    ehr,
    cxId,
    practiceId,
    metriportPatientId,
    ehrPatientId,
    jobId,
  }: StartResourceDiffBundlesRequest): Promise<void> {
    await updateWorkflowTracking({ cxId, jobId, status: "processing" });
    const consolidated = await getConsolidated({ cxId, patientId: metriportPatientId });
    if (!consolidated || !consolidated.bundle?.entry || consolidated.bundle.entry.length < 1) {
      return;
    }
    const supportedResources = getSupportedResourcesByEhr(ehr);
    const resourceTypes = new Set<SupportedResourceType>();
    const computeResourceDiffParams = consolidated.bundle.entry.flatMap(bundleEntry => {
      if (!bundleEntry.resource) return [];
      const newResourceSafeParsed = fhirResourceSchema.safeParse(bundleEntry.resource);
      if (!newResourceSafeParsed.success) {
        throw new MetriportError("Invalid resource when starting resource diff", undefined, {
          resourceType: bundleEntry.resource.resourceType,
          resourceId: bundleEntry.resource.id,
        });
      }
      const newResource = newResourceSafeParsed.data;
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
          jobId,
        },
      ];
    });
    for (const resourceType of resourceTypes) {
      const [existingResourcesBundle] = await Promise.all([
        fetchEhrBundleFromApi({
          ehr,
          cxId,
          practiceId,
          patientId: ehrPatientId,
          resourceType,
          useCachedBundle: false,
        }),
        createOrReplaceBundleOnS3({
          ehr,
          cxId,
          metriportPatientId,
          ehrPatientId,
          bundleType: BundleType.RESOURCE_DIFF_METRIPORT_ONLY,
          bundle: getDefaultBundle(),
          resourceType,
          jobId,
        }),
      ]);
      this.fetchedBundles.set(resourceType, existingResourcesBundle.bundle);
    }
    const computeResourceDiffParamsWithExistingResources = computeResourceDiffParams.flatMap(
      param => {
        const existingResourcesBundle = this.fetchedBundles.get(param.newResource.resourceType);
        if (!existingResourcesBundle) return [];
        const existingResources = existingResourcesBundle.entry.map(entry => entry.resource);
        return [{ ...param, existingResources }];
      }
    );
    const total = computeResourceDiffParamsWithExistingResources.length;
    await updateWorkflowTracking({ cxId, jobId, total });
    await this.next.computeResourceDiffBundlesMetriportOnly(
      computeResourceDiffParamsWithExistingResources
    );
    if (this.waitTimeInMillis > 0) await sleep(this.waitTimeInMillis);
  }

  async startResourceDiffBundlesEhrOnly(): Promise<void> {
    throw new MetriportError("Resource diff bundle EhrOnly is not supported");
  }
}
