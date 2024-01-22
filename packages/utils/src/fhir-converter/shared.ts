import { Bundle, Resource, ResourceType } from "@medplum/fhirtypes";

export function countResourcesPerType(bundle: Bundle<Resource>) {
  if (!bundle || !bundle.entry) {
    throw new Error("Invalid bundle");
  }
  const countPerType = bundle.entry.reduce((acc, entry) => {
    const type = entry.resource?.resourceType;
    if (!type) return acc;
    if (acc[type]) acc[type]++;
    else acc[type] = 1;
    return acc;
  }, {} as Record<ResourceType, number>);

  const ordered = (Object.keys(countPerType).sort() as ResourceType[]).reduce((obj, key) => {
    obj[key] = countPerType[key];
    return obj;
  }, {} as Record<ResourceType, number>);

  return ordered;
}
