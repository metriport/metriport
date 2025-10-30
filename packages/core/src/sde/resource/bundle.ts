import { Bundle, BundleEntry, Resource } from "@medplum/fhirtypes";
import { buildBundle } from "../../external/fhir/bundle/bundle";

export function createBundle(resources: Resource[]): Bundle {
  const entries = resources.map(createBundleEntry);
  return buildBundle({ type: "collection", entries });
}

export function createBundleEntry(resource: Resource): BundleEntry {
  return {
    fullUrl: `urn:uuid:${resource.id}`,
    resource: resource,
  };
}
