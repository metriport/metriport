import { Bundle, Resource } from "@medplum/fhirtypes";

export interface SearchSetBundle<T extends Resource = Resource> extends Omit<Bundle<T>, "type"> {
  type: "searchset";
}

export interface CollectionBundle<T extends Resource = Resource> extends Omit<Bundle<T>, "type"> {
  type: "collection";
}

export function parseFhirBundle(value: string): Bundle | undefined {
  const parsed = JSON.parse(value);
  if (parsed && typeof parsed === "object" && parsed.resourceType === "Bundle") {
    return parsed;
  }
  return undefined;
}

export function parseSearchsetFhirBundle(value: string): SearchSetBundle | undefined {
  const parsed = parseFhirBundle(value);
  if (parsed && parsed.type === "searchset") {
    return parsed as SearchSetBundle;
  }
  return undefined;
}

export function toSearchSet(bundle: Bundle): SearchSetBundle {
  return { ...bundle, type: "searchset", ...(bundle.entry ? { entry: bundle.entry } : {}) };
}
