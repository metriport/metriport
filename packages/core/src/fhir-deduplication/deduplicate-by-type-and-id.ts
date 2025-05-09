import { BundleEntry, Resource } from "@medplum/fhirtypes";

export function deduplicateBundleEntriesByTypeAndId(
  uploads: BundleEntry<Resource>[]
): BundleEntry<Resource>[] {
  const uniqueEntries = new Map<string, BundleEntry<Resource>>();

  uploads.forEach(entry => {
    if (!entry.resource?.resourceType || !entry.resource?.id) {
      return;
    }

    const dedupKey = `${entry.resource.resourceType}${entry.resource.id}`;
    uniqueEntries.set(dedupKey, entry);
  });

  return Array.from(uniqueEntries.values());
}
