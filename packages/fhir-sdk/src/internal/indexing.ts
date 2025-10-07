import { Bundle, Resource } from "@medplum/fhirtypes";
import { ReverseReference } from "../types/sdk-types";
import { IntervalTree } from "../utils/interval-tree";
import { DateIndexRecord } from "../types/sdk-types";
import {
  findAllReferences,
  extractTargetIdFromReference,
  normalizeReferenceField,
} from "./reference-utils";
import { extractDateIntervalsFromResource } from "./date-extraction";

/**
 * Build O(1) indexes for resource lookup
 */
export function buildResourceIndexes(
  bundle: Bundle,
  resourcesById: Map<string, Resource>,
  resourcesByFullUrl: Map<string, Resource>,
  resourcesByType: Map<string, Resource[]>,
  reverseReferencesById: Map<string, ReverseReference[]>,
  dateRangeIndex: IntervalTree<DateIndexRecord, number>,
  resolutionStack: Set<string>
): void {
  if (!bundle.entry) {
    return;
  }

  for (const entry of bundle.entry) {
    if (!entry.resource) {
      continue;
    }

    const resource = entry.resource;

    // Index by resource.id if it exists
    if (resource.id) {
      resourcesById.set(resource.id, resource);
    }

    // Index by fullUrl if it exists
    if (entry.fullUrl) {
      resourcesByFullUrl.set(entry.fullUrl, resource);
    }

    // Index by resource type for type-specific getters
    const resourceType = resource.resourceType;
    if (!resourcesByType.has(resourceType)) {
      resourcesByType.set(resourceType, []);
    }
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    resourcesByType.get(resourceType)!.push(resource);
  }

  // Build reverse reference index
  buildReverseReferenceIndex(bundle, reverseReferencesById, resourcesByFullUrl);

  // Build date range index
  buildDateRangeIndex(bundle, dateRangeIndex);

  // Clear resolution stack after index building
  resolutionStack.clear();
}

/**
 * Build reverse reference index for O(1) reverse lookup
 */
export function buildReverseReferenceIndex(
  bundle: Bundle,
  reverseReferencesById: Map<string, ReverseReference[]>,
  resourcesByFullUrl: Map<string, Resource>
): void {
  if (!bundle.entry) {
    return;
  }

  for (const entry of bundle.entry) {
    if (!entry.resource) {
      continue;
    }

    const resource = entry.resource;
    const sourceResourceId = resource.id ?? entry.fullUrl ?? "unknown";
    const references = findAllReferences(resource);

    for (const { field, reference } of references) {
      // Extract target ID from reference
      const targetId = extractTargetIdFromReference(reference);
      if (!targetId) {
        continue;
      }

      // Add to reverse index for both the extracted ID and the full reference
      const reverseRef: ReverseReference = {
        sourceResourceId,
        sourceResourceType: resource.resourceType,
        referenceField: normalizeReferenceField(field),
      };

      // Index by extracted resource ID (e.g., "patient-123" from "Patient/patient-123")
      if (!reverseReferencesById.has(targetId)) {
        reverseReferencesById.set(targetId, []);
      }
      reverseReferencesById.get(targetId)?.push(reverseRef);

      // Also index by full reference if it's different (e.g., "urn:uuid:patient-123")
      if (targetId !== reference) {
        if (!reverseReferencesById.has(reference)) {
          reverseReferencesById.set(reference, []);
        }
        reverseReferencesById.get(reference)?.push(reverseRef);
      }

      // Also try to index by the actual resource ID if we can find it efficiently
      // Check if this reference can be resolved to a resource with a different ID
      if (!reference.includes("/")) {
        // This is likely a fullUrl reference (e.g., "urn:uuid:xxx")
        // Check if we have a resource with this fullUrl
        const targetResource = resourcesByFullUrl.get(reference);
        if (
          targetResource?.id &&
          targetResource.id !== targetId &&
          targetResource.id !== reference
        ) {
          if (!reverseReferencesById.has(targetResource.id)) {
            reverseReferencesById.set(targetResource.id, []);
          }
          reverseReferencesById.get(targetResource.id)?.push(reverseRef);
        }
      }
    }
  }
}

/**
 * Build date range index for O(log n + k) date range searches
 */
export function buildDateRangeIndex(
  bundle: Bundle,
  dateRangeIndex: IntervalTree<DateIndexRecord, number>
): void {
  if (!bundle.entry) {
    return;
  }

  for (const entry of bundle.entry) {
    if (!entry.resource || !entry.resource.id) {
      continue;
    }

    const resource = entry.resource;
    const dateIntervals = extractDateIntervalsFromResource(resource);

    for (const interval of dateIntervals) {
      dateRangeIndex.insert(interval);
    }
  }
}
