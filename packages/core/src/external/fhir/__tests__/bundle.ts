import { Bundle, BundleEntry, Resource } from "@medplum/fhirtypes";

export const makeBundle = <T extends Resource>({ entries }: { entries: T[] }): Bundle<T> => {
  const entry = entries.map(makeBundleEntryFor);
  return {
    resourceType: "Bundle",
    type: "transaction",
    entry,
  };
};

export const makeBundleEntry = <T extends Resource>(
  entry: Partial<BundleEntry<T>>
): BundleEntry<T> => {
  return {
    ...entry,
  };
};

export const makeBundleEntryFor = <T extends Resource>(resource: T): BundleEntry<T> => {
  return {
    resource,
  };
};
