import { inspect } from "util";
import { Resource } from "@medplum/fhirtypes";
import {
  Smart,
  getReferenceField,
  isReferenceMethod,
  REFERENCE_METHOD_MAPPING,
} from "../types/smart-resources";
import { ReverseReferenceOptions } from "../types/sdk-types";

/**
 * Navigate through a nested path in a resource to get the value at that path.
 * Handles both simple paths ("subject") and nested paths ("diagnosis.condition").
 *
 * For nested paths where the intermediate level is an array:
 * - "diagnosis.condition" navigates to resource.diagnosis[], extracts .condition from each element
 * - Returns an array of all reference values found
 *
 * For nested paths where the intermediate level is an object:
 * - "hospitalization.origin" navigates to resource.hospitalization.origin
 * - Returns the single reference value
 *
 * @param resource - The FHIR resource to navigate
 * @param path - Dot-separated path to the reference field
 * @returns The value at the path, which could be a reference, array of references, or undefined
 */
function getNestedValue(resource: Resource, path: string): unknown {
  const parts = path.split(".");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let current: any = resource;

  for (const part of parts) {
    if (!current) {
      return undefined;
    }

    // If current is an array, map over it and collect values
    if (Array.isArray(current)) {
      const values = current.map(item => item?.[part]).filter(v => v !== undefined);
      current = values.length > 0 ? values : undefined;
    } else {
      current = current[part];
    }
  }

  return current;
}

/**
 * Check if a reference field expects an array of references.
 * Handles both simple paths ("performer") and nested paths ("diagnosis.condition").
 *
 * For nested paths, if the intermediate level is an array, the method returns an array.
 * For example, "diagnosis.condition" returns an array because diagnosis is an array field.
 */
export function isArrayReferenceField(fieldName: string): boolean {
  // Known simple array reference fields
  const arrayFields = new Set(["performer", "participant", "result", "generalPractitioner"]);

  // Check if this is a simple array field
  if (arrayFields.has(fieldName)) {
    return true;
  }

  // For nested paths, check if the base field (first part) is an array
  // Examples: "diagnosis.condition", "participant.individual", "media.link"
  if (fieldName.includes(".")) {
    const parts = fieldName.split(".");
    const baseField = parts[0];

    // Known base fields that are arrays (and thus make their nested references arrays)
    const arrayBaseFields = new Set([
      "diagnosis",
      "participant",
      "location",
      "contact",
      "qualification",
      "link",
      "media",
      "performer",
      "attester",
      "relatesTo",
      "event",
      "section",
      "stage",
      "evidence",
      "protocolApplied",
      "reaction",
      "ingredient",
      "activity",
    ]);

    return arrayBaseFields.has(baseField ?? "");
  }

  return false;
}

/**
 * Resolve a single reference object to a resource
 * FR-5.5: Reference resolution methods handle both resource.id and fullUrl matching
 */
export function resolveReferenceObject(
  referenceObj: unknown,
  resourcesById: Map<string, Resource>,
  resourcesByFullUrl: Map<string, Resource>,
  resolutionStack: Set<string>
): Resource | undefined {
  if (!referenceObj || typeof referenceObj !== "object" || !("reference" in referenceObj)) {
    return undefined;
  }

  const reference = (referenceObj as { reference: string }).reference;

  // Circular reference protection
  if (resolutionStack.has(reference)) {
    return undefined;
  }

  resolutionStack.add(reference);

  try {
    // Try to resolve by resource ID (e.g., "Patient/123")
    if (reference.includes("/")) {
      const [, resourceId] = reference.split("/");
      if (resourceId && resourcesById.has(resourceId)) {
        return resourcesById.get(resourceId);
      }
    }

    // Try to resolve by fullUrl (e.g., "urn:uuid:123")
    if (resourcesByFullUrl.has(reference)) {
      return resourcesByFullUrl.get(reference);
    }

    return undefined;
  } finally {
    resolutionStack.delete(reference);
  }
}

/**
 * Resolve a reference method call to actual resources
 * FR-5.2-5.6: Handle different reference types and patterns
 */
export function resolveReference(
  methodName: string,
  resource: Resource,
  resourcesById: Map<string, Resource>,
  resourcesByFullUrl: Map<string, Resource>,
  resolutionStack: Set<string>,
  createSmartResourceFn: <T extends Resource>(resource: T) => Smart<T>
): Smart<Resource> | Smart<Resource>[] | undefined {
  const referenceField = getReferenceField(methodName, resource.resourceType);
  if (!referenceField) {
    return undefined;
  }

  // Use getNestedValue to handle both simple and nested paths
  const referenceValue = getNestedValue(resource, referenceField);
  if (!referenceValue) {
    // FR-5.6: Return appropriate empty value for missing references
    return isArrayReferenceField(referenceField) ? [] : undefined;
  }

  // Handle array references
  if (Array.isArray(referenceValue)) {
    const resolvedResources: Smart<Resource>[] = [];
    for (const ref of referenceValue) {
      const resolved = resolveReferenceObject(
        ref,
        resourcesById,
        resourcesByFullUrl,
        resolutionStack
      );
      if (resolved) {
        resolvedResources.push(createSmartResourceFn(resolved));
      }
    }
    return resolvedResources;
  }

  // Handle single reference - we know it's not an array at this point
  const resolved = resolveReferenceObject(
    referenceValue,
    resourcesById,
    resourcesByFullUrl,
    resolutionStack
  );
  if (resolved) {
    // Type assertion is safe here because we've established this is the single reference path
    return createSmartResourceFn(resolved) as Smart<Resource>;
  }
  return undefined;
}

/**
 * Create a smart resource with reference resolution methods
 * FR-5.1: Resources returned by SDK have additional getter methods for each Reference field
 * FR-5.7: Reference resolution operates in O(1) time complexity per reference
 * FR-5.8: Original reference fields remain unchanged
 */
export function createSmartResource<T extends Resource>(
  resource: T,
  smartResourceCache: WeakMap<Resource, Smart<Resource>>,
  resourcesById: Map<string, Resource>,
  resourcesByFullUrl: Map<string, Resource>,
  resolutionStack: Set<string>,
  getResourcesReferencingIdFn: (
    targetId: string,
    options?: ReverseReferenceOptions
  ) => Smart<Resource>[]
): Smart<T> {
  // Check cache first to maintain object identity
  const cached = smartResourceCache.get(resource);
  if (cached) {
    return cached as Smart<T>;
  }

  const smartResource = new Proxy(resource, {
    get: (target, prop, receiver) => {
      // Handle the smart resource marker
      if (prop === "__isSmartResource") {
        return true;
      }

      // Handle reverse reference method
      if (prop === "getReferencingResources") {
        return (options?: ReverseReferenceOptions) => {
          const resourceId = target.id;
          if (!resourceId) {
            return [];
          }
          return getResourcesReferencingIdFn(resourceId, options);
        };
      }

      // Handle forward reference method
      if (prop === "getReferencedResources") {
        return () => {
          const referencedResources: Smart<Resource>[] = [];
          const referenceMethods = REFERENCE_METHOD_MAPPING[target.resourceType];

          if (!referenceMethods) {
            return referencedResources;
          }

          // Iterate through all reference methods for this resource type
          for (const methodName of Object.keys(referenceMethods)) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const result = (smartResource as any)[methodName]();

            if (!result) {
              continue;
            }

            // Handle both single and array references
            if (Array.isArray(result)) {
              referencedResources.push(
                ...result.filter((r: Smart<Resource> | undefined) => r !== undefined)
              );
            } else {
              referencedResources.push(result);
            }
          }

          return referencedResources;
        };
      }

      // Handle toString method
      if (prop === "toString") {
        return (space?: number) => {
          return JSON.stringify(target, null, space ?? 2);
        };
      }

      // Handle Node.js util.inspect.custom for console.log and REPL
      if (prop === inspect.custom) {
        return () => {
          return JSON.stringify(target, null, 2);
        };
      }

      // Check if this is a reference method call
      if (typeof prop === "string" && isReferenceMethod(prop, target.resourceType)) {
        return () =>
          resolveReference(prop, target, resourcesById, resourcesByFullUrl, resolutionStack, res =>
            createSmartResource(
              res,
              smartResourceCache,
              resourcesById,
              resourcesByFullUrl,
              resolutionStack,
              getResourcesReferencingIdFn
            )
          );
      }

      // Return original property
      return Reflect.get(target, prop, receiver);
    },

    // Ensure JSON serialization works correctly (FR-5.8)
    ownKeys: target => {
      return Reflect.ownKeys(target).filter(
        key =>
          key !== "__isSmartResource" &&
          key !== "getReferencingResources" &&
          key !== "getReferencedResources" &&
          key !== "toString" &&
          key !== inspect.custom
      );
    },

    getOwnPropertyDescriptor: (target, prop) => {
      if (
        prop === "__isSmartResource" ||
        prop === "getReferencingResources" ||
        prop === "getReferencedResources" ||
        prop === "toString" ||
        prop === inspect.custom
      ) {
        return undefined;
      }
      return Reflect.getOwnPropertyDescriptor(target, prop);
    },
  }) as Smart<T>;

  // Cache the smart resource
  smartResourceCache.set(resource, smartResource);

  return smartResource;
}
