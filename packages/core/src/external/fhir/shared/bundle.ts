import { Bundle, BundleEntry, Reference, Resource, ResourceType } from "@medplum/fhirtypes";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { uniq } from "lodash";

dayjs.extend(duration);

const referenceRegex = new RegExp(/"reference":\s*"(.+?)"/g);

/**
 * Returns the references found in the given resources, including the missing ones.
 *
 * @param resources
 * @param referencesToInclude Resource types to include in the result. If empty, references
 *        with all resource types will be included.
 * @returns References found in the given resources, including the missing ones.
 */
export function getReferencesFromResources({
  resources,
  referencesToInclude = [],
  referencesToExclude = [],
}: {
  resources: Resource[];
  referencesToInclude?: ResourceType[];
  referencesToExclude?: ResourceType[];
}): { references: Reference[]; missingReferences: Reference[] } {
  if (resources.length <= 0) return { references: [], missingReferences: [] };
  const resourceIds = resources.flatMap(r => r.id ?? []);
  const references = getReferencesFromRaw(
    JSON.stringify(resources),
    referencesToInclude,
    referencesToExclude
  );
  const missingReferences: Reference[] = [];
  for (const ref of references) {
    if (!ref.id) continue;
    if (!resourceIds.includes(ref.id)) missingReferences.push(ref);
  }
  return { references, missingReferences };
}

function getReferencesFromRaw(
  rawContents: string,
  referencesToInclude: ResourceType[],
  referencesToExclude: ResourceType[]
): Reference[] {
  const matches = rawContents.matchAll(referenceRegex);
  const references = [];
  for (const match of matches) {
    const ref = match[1];
    if (ref) references.push(ref);
  }
  const uniqueRefs = uniq(references);
  const preResult: Reference[] = uniqueRefs.flatMap(r => {
    const parts = r.split("/");
    const type = parts[0] as ResourceType | undefined;
    const id = parts[1];
    if (!id || !type) return [];
    return { type, id, reference: r };
  });
  if (referencesToInclude.length <= 0 && referencesToExclude.length <= 0) return preResult;
  return preResult.filter(
    r =>
      (!referencesToInclude.length || referencesToInclude.includes(r.type as ResourceType)) &&
      !referencesToExclude.includes(r.type as ResourceType)
  );
}

export function buildBundle(entries: BundleEntry[]): Bundle<Resource> {
  return { resourceType: "Bundle", total: entries.length, type: "searchset", entry: entries };
}
