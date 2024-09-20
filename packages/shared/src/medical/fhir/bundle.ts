import { Bundle, Resource } from "@medplum/fhirtypes";

export interface SearchSetBundle<T extends Resource = Resource> extends Omit<Bundle<T>, "type"> {
  type: "searchset";
}

export function parseFhirBundle(value: string): Bundle | undefined {
  const parsed = JSON.parse(value);
  if (parsed && typeof parsed === "object" && parsed.resourceType === "Bundle") {
    return parsed;
  }
  return undefined;
}
