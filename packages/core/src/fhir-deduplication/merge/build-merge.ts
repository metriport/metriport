import { cloneDeep } from "lodash";
import { Resource } from "@medplum/fhirtypes";
import { MetriportError } from "@metriport/shared";
import { MergeConfig, MergeFunction, MergeMap, MergeStrategy } from "./types";

/**
 * Builds a function that merges an array of resources into a single resource. This function was optimized
 * with 0x to eliminate performance bottlenecks, which is why it uses for loops with a carefully chosen
 * execution flow and programming pattern.
 *
 * The generated closure will throw an error if it is called with an empty array!
 */
export function buildMergeFunction<R extends Resource>({
  mergeStrategy,
}: MergeConfig<R>): MergeFunction<R> {
  // Precompute values that are global to all merges for this resource type.
  const mergeKeys = Object.keys(mergeStrategy) as (keyof R)[];

  // Returns a closure that merges a resource array according to the configured merge strategy.
  return function (resources: R[]): R {
    if (resources.length === 0) {
      throw new MetriportError("Merge function must be called with at least one resource");
    }

    const orderedResources = orderByLastUpdated(resources);
    const latestResource = chooseLastResource(orderedResources);
    const masterResource = cloneDeep(latestResource);

    // For each resource that is not the master resource, build a map of values for each key of the
    // FHIR specification for this resource type.
    const mergeMap: MergeMap<R> = {};
    for (const resource of orderedResources) {
      if (resource?.id === masterResource?.id) continue;

      for (const key of mergeKeys) {
        addToMergeMap(mergeMap, key, resource[key]);
      }
    }

    // Apply the merge strategy to the master resource for each key that was found
    for (const key of mergeKeys) {
      const strategy = mergeStrategy[key];
      if (!strategy) continue;
      applyMergeStrategy(mergeMap, strategy, masterResource, key);
    }

    return masterResource;
  };
}

function orderByLastUpdated<R extends Resource>(resources: R[]): R[] {
  return [...resources].sort((a, b) => {
    const aUpdated = a.meta?.lastUpdated;
    const bUpdated = b.meta?.lastUpdated;
    if (!aUpdated) return -Infinity;
    if (!bUpdated) return Infinity;
    return aUpdated.localeCompare(bUpdated);
  });
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

/**
 * Adds the given key-value pair to the merge map.
 * @param mergeMap - the object containing a mapping of key -> array of values
 * @param key - the key to add to the merge map
 * @param value - the value to add to the merge map (into the array for the given key)
 */
export function addToMergeMap<R extends Resource, K extends keyof R>(
  mergeMap: MergeMap<R>,
  key: K,
  value: R[K]
) {
  if (value == null) return;
  if (mergeMap[key] == null) {
    mergeMap[key] = [];
  }
  mergeMap[key]?.push(value);
}

/**
 * Applies the given merge strategy to the master resource for the given key.
 * @param mergeMap - the map that was built by `buildMergeMap`
 * @param strategy - the merge strategy to apply (a function which takes the master resource value and the corresponding values from the merge map)
 * @param masterResource - the master resource to apply the merge strategy to
 * @param key - the key to apply the merge strategy to
 *
 * @see strategy.ts for common merge strategies
 */
export function applyMergeStrategy<R extends Resource, K extends keyof R>(
  mergeMap: MergeMap<R>,
  strategy: MergeStrategy<R, K>,
  masterResource: R,
  key: K
): void {
  const masterResourceValue = masterResource[key];
  const mergeValues = mergeMap[key];
  if (!mergeValues) return;
  masterResource[key] = strategy(masterResourceValue, mergeValues);
}
