import { Resource } from "@medplum/fhirtypes";
import { Smart, getReferenceField, isReferenceMethod } from "../types/smart-resources";
import { ReverseReferenceOptions } from "../types/sdk-types";

/**
 * Check if a reference field expects an array of references
 */
export function isArrayReferenceField(fieldName: string): boolean {
  // Known array reference fields
  const arrayFields = new Set(["performer", "participant", "result", "generalPractitioner"]);
  return arrayFields.has(fieldName);
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const referenceValue = (resource as any)[referenceField];
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
        key => key !== "__isSmartResource" && key !== "getReferencingResources"
      );
    },

    getOwnPropertyDescriptor: (target, prop) => {
      if (prop === "__isSmartResource" || prop === "getReferencingResources") {
        return undefined;
      }
      return Reflect.getOwnPropertyDescriptor(target, prop);
    },
  }) as Smart<T>;

  // Cache the smart resource
  smartResourceCache.set(resource, smartResource);

  return smartResource;
}
