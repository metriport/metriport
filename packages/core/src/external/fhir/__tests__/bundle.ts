import { Bundle, BundleEntry, Resource } from "@medplum/fhirtypes";

export function makeBundle<T extends Resource>({ entries }: { entries?: T[] } = {}): Bundle<T> {
  const entry = entries ? entries.map(makeBundleEntryFor) : undefined;
  return {
    resourceType: "Bundle",
    type: "transaction",
    ...(entry ? { entry } : {}),
  };
}

export function makeBundleEntry<T extends Resource>(
  entry?: Partial<BundleEntry<T>>
): BundleEntry<T> {
  return {
    ...entry,
  };
}

export function makeBundleEntryFor<T extends Resource>(resource: T): BundleEntry<T> {
  return {
    resource,
  };
}
