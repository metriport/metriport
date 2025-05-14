import { Resource } from "@medplum/fhirtypes";
import { BadRequestError } from "@metriport/shared";
import { z } from "zod";
import { deduplicateResources } from "./dedup-resources";
import { artifactRelatedArtifactUrl } from "./shared";

/**
 * Computes the XOR of two lists of resources of the same resource type.
 *
 * Important! The input resources must all be of the same resource type and have no overlapping IDs.
 *
 * @param targetResources - The target resources.
 * @param sourceResources - The source resources.
 * @param schema - The schema to parse the returned Resource objects to the input type. Optional, defaults to casting the Resource type to the input type.
 * @returns The XOR of the target and source resources. Only resources with IDs are returned.
 */
export function computeResourcesXorAlongResourceType<T extends Resource>({
  targetResources,
  sourceResources,
  schema,
}: {
  targetResources: T[];
  sourceResources: T[];
  schema?: z.ZodSchema<T>;
}): {
  computedXorTargetResources: T[];
  computedXorSourceResources: T[];
} {
  if (targetResources.length < 1) {
    return { computedXorTargetResources: [], computedXorSourceResources: sourceResources };
  }
  if (sourceResources.length < 1) {
    return { computedXorTargetResources: targetResources, computedXorSourceResources: [] };
  }
  const targetResourceIds: Set<string> = new Set();
  const targetResourceTypes: Set<string> = new Set();
  const targetResourcesNoDerivedFromExtension: T[] = [];
  for (const resource of targetResources) {
    if (resource.id) targetResourceIds.add(resource.id);
    targetResourceTypes.add(resource.resourceType);
    targetResourcesNoDerivedFromExtension.push(removeDerivedFromExtension(resource));
  }
  if (targetResourceTypes.size > 1) {
    throw new BadRequestError("Invalid target resource types", undefined, {
      targetResourceTypes: Array.from(targetResourceTypes).join(","),
    });
  }
  const sourceResourceIds: Set<string> = new Set();
  const sourceResourceTypes: Set<string> = new Set();
  const sourceResourcesNoDerivedFromExtension: T[] = [];
  for (const resource of sourceResources) {
    const resourceId = resource.id;
    if (resourceId) {
      if (targetResourceIds.has(resourceId)) {
        throw new BadRequestError(
          "Source and target resources must have no overlapping IDs",
          undefined,
          {
            idIntersection: resourceId,
          }
        );
      }
      sourceResourceIds.add(resourceId);
    }
    sourceResourceTypes.add(resource.resourceType);
    sourceResourcesNoDerivedFromExtension.push(removeDerivedFromExtension(resource));
  }
  if (sourceResourceTypes.size > 1) {
    throw new BadRequestError("Invalid source resource types", undefined, {
      sourceResourceTypes: Array.from(sourceResourceTypes).join(","),
    });
  }
  const targetResourceType = targetResourceTypes.values().next().value;
  const sourceResourceType = sourceResourceTypes.values().next().value;
  if (targetResourceType !== sourceResourceType) {
    throw new BadRequestError("Target and source resource types must match", undefined, {
      targetResourceType,
      sourceResourceType,
    });
  }
  const resources = targetResourcesNoDerivedFromExtension.concat(
    sourceResourcesNoDerivedFromExtension
  );
  const deduplicatedResources = deduplicateResources<T>({ resources, schema });
  const computedXorTargetResources: T[] = [];
  const computedXorSourceResources: T[] = [];
  for (const resource of deduplicatedResources) {
    if (!resource.id || isResourceDerived(resource)) continue;
    if (targetResourceIds.has(resource.id)) {
      computedXorTargetResources.push(resource);
    } else if (sourceResourceIds.has(resource.id)) {
      computedXorSourceResources.push(resource);
    }
  }
  return { computedXorTargetResources, computedXorSourceResources };
}

function removeDerivedFromExtension<T extends Resource>(resource: T): T {
  if (!("extension" in resource) || !resource.extension) return resource;
  const newExtensions = resource.extension.filter(
    extension => extension.url !== artifactRelatedArtifactUrl
  );
  return { ...resource, extension: newExtensions } as T;
}

function isResourceDerived<T extends Resource>(resource: T): boolean {
  if (!("extension" in resource)) return false;
  const derivedFrom = resource.extension.find(
    extension => extension.url === artifactRelatedArtifactUrl
  );
  return derivedFrom !== undefined;
}
