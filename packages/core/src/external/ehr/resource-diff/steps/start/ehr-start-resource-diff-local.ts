import { MetriportError, sleep } from "@metriport/shared";
import {
  Bundle,
  fhirResourceSchema,
  getDefaultBundle,
  SupportedResourceType,
} from "@metriport/shared/interface/external/ehr/fhir-resource";
import { getConsolidated } from "../../../../../command/consolidated/consolidated-get";
import { fetchBundle as fetchBundleFromApi } from "../../../api/fetch-bundle";
import { BundleType, getSupportedResourcesByEhr } from "../../../bundle/bundle-shared";
import { createOrReplaceBundle as createOrReplaceBundleOnS3 } from "../../../bundle/commands/create-or-replace-bundle";
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
  }: StartResourceDiffRequest): Promise<void> {
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
        },
      ];
    });
    for (const resourceType of resourceTypes) {
      const [existingResourcesBundle] = await Promise.all([
        fetchBundleFromApi({
          ehr,
          cxId,
          practiceId,
          patientId: ehrPatientId,
          resourceType,
          useExistingBundle: false,
        }),
        createOrReplaceBundleOnS3({
          ehr,
          cxId,
          metriportPatientId,
          ehrPatientId,
          bundleType: BundleType.METRIPORT_ONLY,
          bundle: getDefaultBundle(),
          resourceType,
        }),
      ]);
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
    await this.next.computeResourceDiff(computeResourceDiffParamsWithExistingResources);
    if (this.waitTimeInMillis > 0) await sleep(this.waitTimeInMillis);
  }
}
