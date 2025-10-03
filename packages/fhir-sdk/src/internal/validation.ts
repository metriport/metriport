import { Bundle, Resource } from "@medplum/fhirtypes";
import { ValidationResult, BrokenReference } from "../types/sdk-types";
import { findAllReferences, canResolveReference } from "./reference-utils";

/**
 * Validate all references in the bundle
 * FR-2.1: Validate all references in the bundle
 * FR-2.2: Identifies references by Resource/id pattern and fullUrl references
 * FR-2.3: Handles both relative and absolute references
 * FR-2.4: Returns validation result with broken reference details
 *
 * @param bundle - The FHIR bundle to validate
 * @param resourcesById - Map of resources indexed by resource.id
 * @param resourcesByFullUrl - Map of resources indexed by entry.fullUrl
 * @returns ValidationResult with broken reference details
 */
export function lookForBrokenReferences(
  bundle: Bundle,
  resourcesById: Map<string, Resource>,
  resourcesByFullUrl: Map<string, Resource>
): ValidationResult {
  const brokenReferences: BrokenReference[] = [];

  if (!bundle.entry) {
    return { hasBrokenReferences: false, brokenReferences: [] };
  }

  for (const entry of bundle.entry) {
    if (!entry.resource) {
      continue;
    }

    const resource = entry.resource;
    const resourceReferences = findAllReferences(resource);

    for (const { field, reference } of resourceReferences) {
      if (!canResolveReference(reference, resourcesById, resourcesByFullUrl)) {
        brokenReferences.push({
          sourceResourceId: resource.id || entry.fullUrl || "unknown",
          sourceResourceType: resource.resourceType,
          referenceField: field,
          reference: reference,
        });
      }
    }
  }

  return {
    hasBrokenReferences: brokenReferences.length > 0,
    brokenReferences: brokenReferences,
  };
}
