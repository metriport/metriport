import { cloneDeep } from "lodash";
import { Resource } from "@medplum/fhirtypes";
import { MetriportError } from "@metriport/shared";
import { MergeConfig, MergeFunction } from "./types";
import { buildStatusOrderingFunction } from "./status";
import { buildMergeMap, addToMergeMap, applyMergeStrategy } from "./merge-map";

/**
 * Builds a function that merges an array of resources into a single resource. This function was optimized
 * with 0x to eliminate performance bottlenecks, which is why it uses for loops with a carefully chosen
 * execution flow and programming pattern.
 *
 * The generated closure will throw an error if it is called with an empty array!
 */
export function buildMergeFunction<R extends Resource>({
  mergeStrategy,
  statusPrecedence,
  chooseMasterResource,
}: MergeConfig<R>): MergeFunction<R> {
  // Precompute values that are global to all merges for this resource type.
  const orderingFunction = buildStatusOrderingFunction<R>(statusPrecedence);
  const masterResourceFunction = chooseMasterResource ? chooseMasterResource : chooseLastResource;
  const mergeKeys = Object.keys(mergeStrategy) as (keyof R)[];

  // Returns a closure that merges a resource array according to the configured merge strategy.
  return function (resources: R[]): R {
    if (resources.length === 0) {
      throw new MetriportError("Merge function must be called with at least one resource");
    }

    const orderedResources = orderingFunction(resources);
    const masterResource = cloneDeep(masterResourceFunction(orderedResources));

    // For each resource that is not the master resource, build a map of values for each key of the
    // FHIR specification for this resource type.
    const mergeMap = buildMergeMap<R>(mergeKeys);
    for (const resource of orderedResources) {
      if (resource === masterResource) continue;

      for (const key of mergeKeys) {
        addToMergeMap(mergeMap, key, resource[key]);
      }
    }

    // Apply the merge strategy to the master resource for each key
    for (const key of mergeKeys) {
      const strategy = mergeStrategy[key];
      if (!strategy) continue;
      applyMergeStrategy(mergeMap, strategy, masterResource, key);
    }

    return masterResource;
  };
}

/**
 * Defaults to choosing the last resource in the array as the master resource, assuming the
 * resources are sorted in ascending order.
 */
function chooseLastResource<R extends Resource>(resources: R[]): R {
  const lastResource = resources[resources.length - 1];
  if (!lastResource) {
    throw new MetriportError("Merge is always called with at least one resource");
  }
  return lastResource;
}
