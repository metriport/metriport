import { Bundle, BundleEntry, Resource } from "@medplum/fhirtypes";

/**
 * Create a new bundle entry from an existing entry, preserving fullUrl
 */
export function createBundleEntry(originalEntry: BundleEntry, resource: Resource): BundleEntry {
  if (originalEntry.fullUrl) {
    return {
      fullUrl: originalEntry.fullUrl,
      resource: resource,
    };
  }

  return {
    resource: resource,
  };
}

/**
 * Create a new bundle with specified entries, maintaining original metadata
 */
export function createExportBundle(originalBundle: Bundle, entries: BundleEntry[]): Bundle {
  const exportBundle: Bundle = {
    resourceType: "Bundle",
    type: originalBundle.type || "collection",
    total: entries.length,
    entry: entries,
  };

  // Preserve original bundle metadata (FR-6.4)
  if (originalBundle.id) {
    exportBundle.id = originalBundle.id;
  }
  if (originalBundle.meta) {
    exportBundle.meta = { ...originalBundle.meta };
  }
  if (originalBundle.identifier) {
    exportBundle.identifier = originalBundle.identifier;
  }
  if (originalBundle.timestamp) {
    exportBundle.timestamp = originalBundle.timestamp;
  }

  return exportBundle;
}

/**
 * Find original bundle entry for a given resource
 */
export function findOriginalEntry(bundle: Bundle, resource: Resource): BundleEntry | undefined {
  if (!bundle.entry) {
    return undefined;
  }

  return bundle.entry.find(
    entry =>
      entry.resource === resource || (entry.resource?.id && entry.resource.id === resource.id)
  );
}
