import { BadRequestError, sleep } from "@metriport/shared";
import { fhirResourceSchema } from "@metriport/shared/interface/external/ehr/fhir-resource";
import { ResourceDiffDirection } from "@metriport/shared/interface/external/ehr/resource-diff";
import { EhrSources } from "@metriport/shared/interface/external/ehr/source";
import { chunk } from "lodash";
import { getConsolidated } from "../../../../command/consolidated/consolidated-get";
import { computeResourceDiff } from "../../api/resource-diff/compute-resource-diff";
import { supportedCanvasDiffResources } from "../../canvas";
import { EhrStartResourceDiffHandler, StartResourceDiffRequest } from "./ehr-start-resource-diff";

const MAX_RESOURCE_DIFFS_PER_BATCH = 10;
const SLEEP_TIME_IN_MILLIS = 1000;

export class EhrStartResourceDiffLocal implements EhrStartResourceDiffHandler {
  constructor(private readonly waitTimeInMillis: number) {}

  async startResourceDiff({
    ehr,
    cxId,
    practiceId,
    metriportPatientId,
    ehrPatientId,
    direction,
  }: StartResourceDiffRequest): Promise<void> {
    if (direction === ResourceDiffDirection.DIFF_EHR) {
      const consolidated = await getConsolidated({
        cxId,
        patientId: metriportPatientId,
      });
      if (!consolidated || !consolidated.bundle?.entry || consolidated.bundle.entry.length === 0) {
        return;
      }
      const resourceDiffs = consolidated.bundle.entry.flatMap(resource => {
        if (!resource.resource) return [];
        const resourceSafe = fhirResourceSchema.safeParse(resource.resource);
        if (!resourceSafe.success) return [];
        const fhirResource = resourceSafe.data;
        if (
          ehr === EhrSources.canvas &&
          !supportedCanvasDiffResources.includes(fhirResource.resourceType)
        ) {
          return [];
        }
        return [
          {
            ehr,
            cxId,
            practiceId,
            patientId: ehrPatientId,
            resource: fhirResource,
            direction,
          },
        ];
      });
      const chunks = chunk(resourceDiffs, MAX_RESOURCE_DIFFS_PER_BATCH);
      for (const chunk of chunks) {
        await Promise.all(chunk.map(params => computeResourceDiff(params)));
        await sleep(SLEEP_TIME_IN_MILLIS);
      }
    } else if (direction === ResourceDiffDirection.DIFF_METRIPORT) {
      throw new BadRequestError("This direction is not supported yet", undefined, { direction });
    }
    if (this.waitTimeInMillis > 0) await sleep(this.waitTimeInMillis);
  }
}
