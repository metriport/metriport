import { Reference, Resource, ResourceType } from "@medplum/fhirtypes";
import { executeAsynchronously } from "@metriport/core/util/concurrency";
import { chunk, groupBy } from "lodash";
import { makeFhirApi } from "../../../external/fhir/api/api-factory";
import { MAX_IDS_PER_REQUEST } from "../shared/paginated";

const queriesInParallel = 5;

export async function getReferencesFromFHIR(
  references: Reference[],
  fhir: ReturnType<typeof makeFhirApi>,
  log?: typeof console.log
): Promise<Resource[]> {
  if (!references || references.length <= 0) return [];
  const refByType = groupBy(references, r => r.type);
  // chunk each type by X elements and group them back into an array
  const chunks = Object.values(refByType).flatMap(r => chunk(r, MAX_IDS_PER_REQUEST));
  // transform the chunks into array of resource type and ids for each chunk
  const consolidated: { type: ResourceType; ids: string[] }[] = chunks.flatMap(chunk => {
    const type = chunk[0]?.type as ResourceType | undefined;
    const ids = chunk.flatMap(c => c.id ?? []);
    if (!type || ids.length <= 0) return [];
    return { type, ids };
  });

  const resources: Resource[] = [];
  await executeAsynchronously(
    consolidated,
    async c => {
      if (c.ids.length <= 0) return;
      log && log(`Querying for ${c.type} with ids ${c.ids.join(", ")}...`);
      const filtersAsStr = getFilters({ ids: c.ids });
      for await (const page of fhir.searchResourcePages(c.type, filtersAsStr)) {
        resources.push(...page);
      }
    },
    { numberOfParallelExecutions: queriesInParallel, keepExecutingOnError: true }
  );

  return resources;
}

function getFilters({ ids }: { ids: string[] }) {
  const filters = new URLSearchParams();
  if (ids.length <= 0) throw new Error(`Missing ids`);
  filters.append(`_id`, ids.join(","));
  const filtersAsStr = filters.toString();
  return filtersAsStr;
}
