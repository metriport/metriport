import { inspect } from "util";
import { Resource, Coding, CodeableConcept } from "@medplum/fhirtypes";
import {
  Smart,
  getReferenceField,
  isReferenceMethod,
  REFERENCE_METHOD_MAPPING,
} from "../types/smart-resources";
import { ReverseReferenceOptions } from "../types/sdk-types";
import { createSmartCoding, createSmartCodeableConcept } from "./coding-utilities";
import { createTransparentProxy } from "./transparent-proxy";

/**
 * Type guard to check if a value is a CodeableConcept object
 * Must check this BEFORE isCoding since both can have overlapping properties
 */
function isCodeableConcept(value: unknown): value is CodeableConcept {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    ("coding" in value || "text" in value) &&
    // Exclude Reference objects which also have optional text
    !("reference" in value)
  );
}

/**
 * Type guard to check if a value is a Coding object
 * Check for Coding-specific properties and exclude CodeableConcept
 */
function isCoding(value: unknown): value is Coding {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    ("system" in value || "display" in value) &&
    // Make sure it's not a CodeableConcept
    !("coding" in value || "text" in value)
  );
}

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

      // Handle Symbol.toStringTag for better console display
      if (prop === Symbol.toStringTag) {
        return `Smart<${target.resourceType}>`;
      }

      // Handle toJSON for serialization
      if (prop === "toJSON") {
        return () => target;
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

      // Get the property value
      const value = Reflect.get(target, prop, receiver);

      // Don't wrap null or undefined
      if (value === null || value === undefined) {
        return value;
      }

      // Wrap CodeableConcept objects (check before Coding to avoid misidentification)
      if (isCodeableConcept(value)) {
        return createSmartCodeableConcept(value);
      }

      // Wrap Coding objects
      if (isCoding(value)) {
        return createSmartCoding(value);
      }

      // Handle arrays - wrap each element if needed
      if (Array.isArray(value)) {
        return value.map(item => {
          if (item === null || item === undefined) {
            return item;
          }
          // Check CodeableConcept before Coding
          if (isCodeableConcept(item)) {
            return createSmartCodeableConcept(item);
          }
          if (isCoding(item)) {
            return createSmartCoding(item);
          }
          // Recursively wrap plain objects with transparent proxy
          // Only wrap plain objects, not built-in types
          if (typeof item === "object" && !Array.isArray(item) && item.constructor === Object) {
            return createTransparentProxy(item);
          }
          return item;
        });
      }

      // Recursively wrap plain objects with transparent proxy (but not primitives, dates, etc.)
      // Only wrap plain objects, not built-in types like Date, RegExp, etc.
      if (typeof value === "object" && !Array.isArray(value) && value.constructor === Object) {
        return createTransparentProxy(value);
      }

      // Return original property for primitives and other types
      return value;
    },

    // Ensure JSON serialization works correctly (FR-5.8)
    ownKeys: target => {
      const keys = Reflect.ownKeys(target);
      const virtualMethods: (string | symbol)[] = [
        "getReferencingResources",
        "getReferencedResources",
        "toString",
      ];

      // Add reference methods for this resource type
      const referenceMethods = REFERENCE_METHOD_MAPPING[target.resourceType];
      if (referenceMethods) {
        virtualMethods.push(...Object.keys(referenceMethods));
      }

      // Filter out internal markers and add virtual methods for DevTools
      return [...keys.filter(key => key !== "__isSmartResource"), ...virtualMethods] as ArrayLike<
        string | symbol
      >;
    },

    getOwnPropertyDescriptor: (target, prop) => {
      // Hide internal markers from enumeration
      if (
        prop === "__isSmartResource" ||
        prop === Symbol.toStringTag ||
        prop === "toJSON" ||
        prop === inspect.custom
      ) {
        return undefined;
      }

      // Make virtual methods enumerable for DevTools
      if (
        prop === "getReferencingResources" ||
        prop === "getReferencedResources" ||
        prop === "toString"
      ) {
        return {
          enumerable: true,
          configurable: true,
          writable: false,
        };
      }

      // Make reference methods enumerable for DevTools
      const referenceMethods = REFERENCE_METHOD_MAPPING[target.resourceType];
      if (referenceMethods && typeof prop === "string" && prop in referenceMethods) {
        return {
          enumerable: true,
          configurable: true,
          writable: false,
        };
      }

      return Reflect.getOwnPropertyDescriptor(target, prop);
    },
  }) as Smart<T>;

  // Cache the smart resource - cast to avoid type complexity issues
  smartResourceCache.set(resource, smartResource as Smart<Resource>);

  return smartResource;
}
