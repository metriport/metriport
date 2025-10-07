import { Resource } from "@medplum/fhirtypes";

/**
 * Find all Reference fields in a resource recursively
 */
export function findAllReferences(resource: Resource): Array<{ field: string; reference: string }> {
  const references: Array<{ field: string; reference: string }> = [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function searchObject(obj: any, path = ""): void {
    if (!obj || typeof obj !== "object") {
      return;
    }

    // Check if this object is a Reference
    if (obj.reference && typeof obj.reference === "string") {
      references.push({
        field: path || "reference",
        reference: obj.reference,
      });
      return;
    }

    // Recursively search object properties
    for (const [key, value] of Object.entries(obj)) {
      const currentPath = path ? `${path}.${key}` : key;

      if (Array.isArray(value)) {
        value.forEach((item, index) => {
          searchObject(item, `${currentPath}[${index}]`);
        });
      } else if (value && typeof value === "object") {
        searchObject(value, currentPath);
      }
    }
  }

  searchObject(resource);
  return references;
}

/**
 * Extract target resource ID from a reference string
 */
export function extractTargetIdFromReference(reference: string): string | undefined {
  if (!reference) {
    return undefined;
  }

  // Handle "ResourceType/id" pattern
  if (reference.includes("/")) {
    const parts = reference.split("/");
    return parts[parts.length - 1];
  }

  // Handle other reference patterns (e.g., "urn:uuid:xxx")
  return reference;
}

/**
 * Normalize reference field path to base field name
 * e.g., "participant.individual" -> "participant"
 *       "performer[0]" -> "performer"
 */
export function normalizeReferenceField(field: string): string {
  // Remove array indices
  const withoutIndices = field.replace(/\[\d+\]/g, "");
  // Take first part of dotted path
  const parts = withoutIndices.split(".");
  return parts[0] ?? field;
}

/**
 * Check if a reference can be resolved within the bundle
 * @param reference - The reference string to check
 * @param resourcesById - Map of resources indexed by resource.id
 * @param resourcesByFullUrl - Map of resources indexed by entry.fullUrl
 */
export function canResolveReference(
  reference: string,
  resourcesById: Map<string, Resource>,
  resourcesByFullUrl: Map<string, Resource>
): boolean {
  // Try to resolve by resource ID (e.g., "Patient/123")
  if (reference.includes("/")) {
    const [, resourceId] = reference.split("/");
    if (resourceId && resourcesById.has(resourceId)) {
      return true;
    }
  }

  // Try to resolve by fullUrl (e.g., "urn:uuid:123")
  if (resourcesByFullUrl.has(reference)) {
    return true;
  }

  return false;
}
