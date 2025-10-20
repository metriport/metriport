import { BundleEntry, Resource } from "@medplum/fhirtypes";

export function mapEntryToResource<T extends Resource>(entry: BundleEntry<T>): T | undefined {
  return entry.resource as T;
}
