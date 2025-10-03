import { Resource } from "@medplum/fhirtypes";
import { Smart } from "../types/smart-resources";
import { LLMContextOptions, WalkResult } from "../types/sdk-types";

/**
 * Strip non-clinical metadata from a FHIR resource to reduce noise for LLM consumption.
 * Removes: meta, extension, modifierExtension, text
 * Returns an immutable copy without mutating the original.
 */
export function stripNonClinicalData<T extends Resource>(resource: T): T {
  function deepCloneAndStrip(obj: unknown): unknown {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map(item => deepCloneAndStrip(item));
    }

    if (typeof obj === "object") {
      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj)) {
        // Skip non-clinical fields
        if (
          key === "meta" ||
          key === "extension" ||
          key === "modifierExtension" ||
          key === "text"
        ) {
          continue;
        }
        result[key] = deepCloneAndStrip(value);
      }
      return result;
    }

    return obj;
  }

  return deepCloneAndStrip(resource) as T;
}

/**
 * Group resources by their resource type
 */
export function groupResourcesByType(resources: Resource[]): Record<string, Resource[]> {
  const grouped: Record<string, Resource[]> = {};

  for (const resource of resources) {
    const type = resource.resourceType;
    if (!grouped[type]) {
      grouped[type] = [];
    }
    const resourceArray = grouped[type];
    if (resourceArray) {
      resourceArray.push(resource);
    }
  }

  return grouped;
}

/**
 * Format a single resource as readable text
 */
export function formatResourceAsText(resource: Resource): string {
  const lines: string[] = [];
  lines.push(`[Type: ${resource.resourceType}, ID: ${resource.id ?? "unknown"}]`);

  function formatValue(value: unknown, indent = 2): string[] {
    const prefix = " ".repeat(indent);
    const result: string[] = [];

    if (value === null || value === undefined) {
      return [`${prefix}(none)`];
    }

    if (Array.isArray(value)) {
      if (value.length === 0) {
        return [`${prefix}[]`];
      }
      for (const [index, item] of value.entries()) {
        result.push(`${prefix}[${index}]:`);
        result.push(...formatValue(item, indent + 2));
      }
      return result;
    }

    if (typeof value === "object") {
      for (const [key, val] of Object.entries(value)) {
        result.push(`${prefix}${key}:`);
        result.push(...formatValue(val, indent + 2));
      }
      return result;
    }

    return [`${prefix}${String(value)}`];
  }

  // Format key fields
  for (const [key, value] of Object.entries(resource)) {
    if (key === "resourceType" || key === "id") continue; // Already shown in header
    lines.push(`  ${key}:`);
    lines.push(...formatValue(value, 4));
  }

  return lines.join("\n");
}

/**
 * Format resources as structured text for better LLM readability
 */
export function formatAsStructuredText(resourcesByDepth: Map<number, Resource[]>): string {
  const lines: string[] = [];

  // Primary resource section
  const primaryResources = resourcesByDepth.get(0) ?? [];
  if (primaryResources.length > 0) {
    lines.push("PRIMARY RESOURCE:");
    lines.push("=".repeat(80));
    for (const resource of primaryResources) {
      lines.push(formatResourceAsText(resource));
      lines.push("");
    }
  }

  // Related resources by depth
  for (const [depth, resources] of resourcesByDepth.entries()) {
    if (depth === 0) continue; // Already handled above

    const depthLabel =
      depth === 1 ? "DIRECTLY REFERENCED" : `INDIRECTLY REFERENCED (Depth ${depth})`;
    lines.push(`${depthLabel} RESOURCES:`);
    lines.push("=".repeat(80));

    // Group by resource type for better organization
    const groupedByType = groupResourcesByType(resources);

    for (const [resourceType, typeResources] of Object.entries(groupedByType)) {
      lines.push(`\n--- ${resourceType} (${typeResources.length}) ---\n`);

      for (const resource of typeResources) {
        lines.push(formatResourceAsText(resource));
        lines.push("");
      }
    }
  }

  return lines.join("\n");
}

/**
 * Format resources as JSON with depth annotations
 */
export function formatAsJSON(resourcesByDepth: Map<number, Resource[]>): string {
  const relatedResourcesByDepth: Record<string, Resource[]> = {};

  for (const [depth, resources] of resourcesByDepth.entries()) {
    if (depth === 0) continue; // Skip primary resource (already at top)
    relatedResourcesByDepth[`depth_${depth}`] = resources;
  }

  const output = {
    primaryResource: resourcesByDepth.get(0)?.[0],
    relatedResourcesByDepth,
  };

  return JSON.stringify(output, null, 2);
}

/**
 * Generate LLM-friendly context from a starting resource and its related resources.
 * Uses BFS to discover related resources, strips non-clinical data, and formats output.
 *
 * @param startResource - The smart resource to start traversal from
 * @param options - Options for depth, inclusion, and format
 * @param walkReferencesFn - Function to walk references (passed in to avoid circular dependency)
 * @returns Formatted string suitable for LLM context
 */
export function generateLLMContext<T extends Resource>(
  startResource: Smart<T>,
  options: LLMContextOptions | undefined,
  walkReferencesFn: (
    startResource: Smart<T>,
    options: { maxDepth: number; includeStartResource: boolean }
  ) => WalkResult<T>
): string {
  const maxDepth = options?.maxDepth ?? 2;
  const includeStartResource = options?.includeStartResource ?? true;
  const format = options?.format ?? "structured-text";

  // Walk the reference graph
  const walkResult = walkReferencesFn(startResource, {
    maxDepth,
    includeStartResource,
  });

  // Log resource counts for debugging
  console.log(`[LLM Context] Total resources discovered: ${walkResult.allResources.length}`);
  for (const [depth, resources] of walkResult.resourcesByDepth.entries()) {
    console.log(`[LLM Context] Depth ${depth}: ${resources.length} resources`);
  }

  // Strip non-clinical data from all resources
  const cleanedResourcesByDepth = new Map<number, Resource[]>();
  for (const [depth, resources] of walkResult.resourcesByDepth.entries()) {
    // Skip depth 0 if includeStartResource is false
    if (depth === 0 && !includeStartResource) {
      continue;
    }
    cleanedResourcesByDepth.set(
      depth,
      resources.map(r => stripNonClinicalData(r))
    );
  }

  // Format based on selected format
  if (format === "json") {
    return formatAsJSON(cleanedResourcesByDepth);
  } else {
    return formatAsStructuredText(cleanedResourcesByDepth);
  }
}
