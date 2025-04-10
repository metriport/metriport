import { BadRequestError, sleep } from "@metriport/shared";
import {
  FhirResource,
  fhirResourceSchema,
} from "@metriport/shared/interface/external/ehr/fhir-resource";
import { ResourceDiffDirection } from "@metriport/shared/interface/external/ehr/resource-diff";
import { chunk } from "lodash";
import { getConsolidated } from "../../../../command/consolidated/consolidated-get";
import { computeResourceDiff } from "../../api/resource-diff/compute-resource-diff";
import { fetchResources } from "../../api/resource-diff/fetch-resources";
import { getSupportedResources } from "../utils";
import { EhrStartResourceDiffHandler, StartResourceDiffRequest } from "./ehr-start-resource-diff";

const MAX_RESOURCE_DIFFS_PER_BATCH = 10;
const SLEEP_TIME_IN_MILLIS = 1000;

export class EhrStartResourceDiffLocal implements EhrStartResourceDiffHandler {
  private readonly fetchedResourceMap: Map<string, FhirResource[]>;

  constructor(private readonly waitTimeInMillis: number) {
    this.fetchedResourceMap = new Map();
  }

  async startResourceDiff({
    ehr,
    cxId,
    practiceId,
    metriportPatientId,
    ehrPatientId,
    direction,
  }: StartResourceDiffRequest): Promise<void> {
    if (direction !== ResourceDiffDirection.DIFF_EHR) {
      throw new BadRequestError("This direction is not supported yet", undefined, { direction });
    }
    const consolidated = await getConsolidated({ cxId, patientId: metriportPatientId });
    if (!consolidated || !consolidated.bundle?.entry || consolidated.bundle.entry.length < 1) {
      return;
    }
    const resourceTypes = new Set<string>();
    const resourceDiffParams = consolidated.bundle.entry.flatMap(bundleEntry => {
      if (!bundleEntry.resource) return [];
      const resourceSafeParsed = fhirResourceSchema.safeParse(bundleEntry.resource);
      if (!resourceSafeParsed.success) return [];
      const newResource = resourceSafeParsed.data;
      const supportedResources = getSupportedResources(ehr);
      if (!supportedResources.includes(newResource.resourceType)) return [];
      resourceTypes.add(newResource.resourceType);
      return [
        {
          ehr,
          cxId,
          patientId: ehrPatientId,
          newResource,
          direction,
        },
      ];
    });
    for (const resourceType of resourceTypes) {
      if (this.fetchedResourceMap.has(resourceType)) continue;
      const existingResources = await fetchResources({
        ehr,
        cxId,
        practiceId,
        patientId: ehrPatientId,
        resourceType,
        useS3: false,
      });
      this.fetchedResourceMap.set(resourceType, existingResources);
    }
    const chunks = chunk(resourceDiffParams, MAX_RESOURCE_DIFFS_PER_BATCH);
    for (const chunk of chunks) {
      await Promise.all(
        chunk.map(params =>
          computeResourceDiff({
            ...params,
            existingResources: this.fetchedResourceMap.get(params.newResource.id) ?? [],
          })
        )
      );
      await sleep(SLEEP_TIME_IN_MILLIS);
    }
    if (this.waitTimeInMillis > 0) await sleep(this.waitTimeInMillis);
  }
}
