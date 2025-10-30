import { Resource } from "@medplum/fhirtypes";
import { BadRequestError } from "@metriport/shared";
import { deduplicateResources } from "./dedup-resources";

/**
 * Computes the XOR of two lists of resources of the same resource type.
 *
 * Important! The input resources must all be of the same resource type.
 *
 * @param targetResources - The target resources.
 * @param sourceResources - The source resources.
 * @returns The XOR of the target and source resources. Only resources with IDs are returned.
 */
export function computeResourcesXorAlongResourceType<T extends Resource>({
  targetResources,
  sourceResources,
}: {
  targetResources: T[];
  sourceResources: T[];
}): { targetOnly: T[]; sourceOnly: T[] } {
  const targetResourceIds: Set<string> = new Set();
  const targetResourceTypes: Set<string> = new Set();
  const targetResourcesNoDerivedFromExtension: T[] = [];
  for (const resource of targetResources) {
    if (resource.id) targetResourceIds.add(resource.id);
    targetResourceTypes.add(resource.resourceType);
    targetResourcesNoDerivedFromExtension.push(resource);
  }
  if (targetResourceTypes.size > 1) {
    throw new BadRequestError("Got more than one target resource type", undefined, {
      targetResourceTypes: Array.from(targetResourceTypes).join(","),
    });
  }
  if (sourceResources.length < 1) {
    return { targetOnly: targetResources, sourceOnly: [] };
  }
  const sourceResourceIds: Set<string> = new Set();
  const sourceResourceTypes: Set<string> = new Set();
  const sourceResourcesNoDerivedFromExtension: T[] = [];
  for (const resource of sourceResources) {
    if (resource.id) sourceResourceIds.add(resource.id);
    sourceResourceTypes.add(resource.resourceType);
    sourceResourcesNoDerivedFromExtension.push(resource);
  }
  if (sourceResourceTypes.size > 1) {
    throw new BadRequestError("Got more than one source resource type", undefined, {
      sourceResourceTypes: Array.from(sourceResourceTypes).join(","),
    });
  }
  if (targetResources.length < 1) {
    return { targetOnly: [], sourceOnly: sourceResources };
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
  const deduplicatedResources = deduplicateResources<T>({ resources });
  const targetOnly: T[] = [];
  const sourceOnly: T[] = [];
  for (const resource of deduplicatedResources) {
    if (!resource.id) continue;
    const inTarget = targetResourceIds.has(resource.id);
    const inSource = sourceResourceIds.has(resource.id);
    if (inTarget && inSource) {
      continue;
    } else if (inTarget) {
      targetOnly.push(resource);
    } else if (inSource) {
      sourceOnly.push(resource);
    }
  }
  return { targetOnly, sourceOnly };
}
