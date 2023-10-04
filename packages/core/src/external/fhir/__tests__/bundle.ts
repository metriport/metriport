import { Bundle, Resource } from "@medplum/fhirtypes";

export const makeBundle = <T extends Resource>({ entries }: { entries: T[] }): Bundle<T> => {
  const entry = entries.map(r => ({
    resource: r,
  }));
  return {
    resourceType: "Bundle",
    type: "transaction",
    entry,
  };
};
