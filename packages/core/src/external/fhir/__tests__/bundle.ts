import { Bundle, BundleEntry, Resource } from "@medplum/fhirtypes";

export type BundleType =
  | "document"
  | "message"
  | "transaction"
  | "transaction-response"
  | "batch"
  | "batch-response"
  | "history"
  | "searchset"
  | "collection";

export function makeBundle<T extends Resource>({
  entries,
  type,
}: { entries?: T[]; type?: BundleType } = {}): Bundle<T> {
  const entry = entries ? entries.map(makeBundleEntryFor) : undefined;
  return {
    resourceType: "Bundle",
    type: type ?? "transaction",
    ...(entry
      ? {
          total: entry.length,
          entry,
        }
      : {}),
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
