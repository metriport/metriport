import { Resource } from "@medplum/fhirtypes";
import { Smart, REFERENCE_METHOD_MAPPING } from "../types/smart-resources";
import { WalkOptions, WalkResult } from "../types/sdk-types";

/**
 * Walk references from a starting resource using BFS traversal.
 * Discovers all reachable resources up to maxDepth levels.
 *
 * @param startResource - The smart resource to start traversal from
 * @param options - Walk options including maxDepth and includeStartResource
 * @returns WalkResult containing all discovered resources organized by depth
 */
export function walkReferences<T extends Resource>(
  startResource: Smart<T>,
  options?: WalkOptions
): WalkResult<T> {
  const maxDepth = options?.maxDepth ?? Infinity;
  const includeStartResource = options?.includeStartResource ?? true;

  const resourcesByDepth = new Map<number, Smart<Resource>[]>();
  const visited = new Set<string>();
  const queue: Array<{ resource: Smart<Resource>; depth: number }> = [];

  // Initialize with start resource at depth 0
  queue.push({ resource: startResource, depth: 0 });
  if (startResource.id) {
    visited.add(startResource.id);
  }

  let maxDepthReached = 0;

  while (queue.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const { resource, depth } = queue.shift()!;

    // Track max depth reached
    if (depth > maxDepthReached) {
      maxDepthReached = depth;
    }

    // Add resource to current depth level
    if (!resourcesByDepth.has(depth)) {
      resourcesByDepth.set(depth, []);
    }
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    resourcesByDepth.get(depth)!.push(resource);

    // Stop if we've reached max depth
    if (depth >= maxDepth) {
      continue;
    }

    // Get all reference methods for this resource type
    const referenceMethods = REFERENCE_METHOD_MAPPING[resource.resourceType];
    if (!referenceMethods) {
      continue;
    }

    // Iterate through all reference methods
    for (const methodName of Object.keys(referenceMethods)) {
      // Call the reference method
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const referencedResources = (resource as any)[methodName]();

      if (!referencedResources) {
        continue;
      }

      // Handle both single and array references
      const resourceArray = Array.isArray(referencedResources)
        ? referencedResources
        : [referencedResources];

      for (const referencedResource of resourceArray) {
        if (!referencedResource?.id) {
          continue;
        }

        // Skip if already visited
        if (visited.has(referencedResource.id)) {
          continue;
        }

        visited.add(referencedResource.id);
        queue.push({ resource: referencedResource, depth: depth + 1 });
      }
    }
  }

  // Build flat array of all resources
  const allResources: Smart<Resource>[] = [];
  for (const [depth, resources] of resourcesByDepth.entries()) {
    // Skip depth 0 (start resource) if includeStartResource is false
    if (depth === 0 && !includeStartResource) {
      continue;
    }
    allResources.push(...resources);
  }

  return {
    resourcesByDepth,
    allResources,
    startResource,
    depthReached: maxDepthReached,
  };
}
