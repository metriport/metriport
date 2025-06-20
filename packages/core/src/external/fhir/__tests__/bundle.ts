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
  type: typeParam,
}: { entries?: T[]; type?: BundleType } = {}): Bundle<T> {
  const entry = entries ? entries.map(makeBundleEntryFor) : undefined;
  const type = typeParam ?? "transaction";
  return {
    resourceType: "Bundle",
    type,
    ...(entry ? { entry } : {}),
    ...(type === "searchset" ? { total: entry?.length ?? 0 } : {}),
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
