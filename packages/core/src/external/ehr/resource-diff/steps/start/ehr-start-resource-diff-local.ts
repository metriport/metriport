import { sleep } from "@metriport/shared";
import {
  Bundle,
  fhirResourceSchema,
  SupportedResourceType,
} from "@metriport/shared/interface/external/ehr/fhir-resource";
import { getConsolidated } from "../../../../../command/consolidated/consolidated-get";
import { fetchOrReplaceBundle } from "../../../api/fetch-or-replace-bundle";
import { getSupportedResourcesByEhr } from "../../resource-dfff-shared";
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
    const resourceTypes = new Set<SupportedResourceType>();
    const resourceDiffParams = consolidated.bundle.entry.flatMap(bundleEntry => {
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
        },
      ];
    });
    for (const resourceType of resourceTypes) {
      const existingResourcesBundle = await fetchOrReplaceBundle({
        ehr,
        cxId,
        practiceId,
        patientId: ehrPatientId,
        resourceType,
        useExistingBundle: true,
      });
      if (existingResourcesBundle.entry.length < 1) continue;
      this.fetchedBundles.set(resourceType, existingResourcesBundle);
    }
    await this.next.computeResourceDiff(
      resourceDiffParams.flatMap(param => {
        const existingResourcesBundle = this.fetchedBundles.get(param.newResource.resourceType);
        if (!existingResourcesBundle) return [];
        return [
          {
            ...param,
            existingResources: existingResourcesBundle.entry.map(entry => entry.resource),
          },
        ];
      })
    );
    if (this.waitTimeInMillis > 0) await sleep(this.waitTimeInMillis);
  }
}
