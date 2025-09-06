import { Resource } from "@medplum/fhirtypes";
import { MergeMap, MergeStrategy } from "./types";

/**
 * A "merge map" for a particular resource is a mapping between all keys of the resource (taken from the FHIR specification)
 * and an array of all values for that key that are *not* from the master resource. If a particular merge strategy is not
 * included, the existing values of the master resource will be retained as-is.
 */
export function buildMergeMap<R extends Resource>(mergeKeys: (keyof R)[]): MergeMap<R> {
  const emptyMergeMap: Partial<MergeMap<R>> = {};
  for (const key of mergeKeys) {
    emptyMergeMap[key] = [];
  }
  return emptyMergeMap as MergeMap<R>;
}

/**
 * Adds the given key-value pair to the merge map.
 * @param mergeMap - the map that was built by `buildMergeMap`
 * @param key - the key to add to the merge map
 * @param value - the value to add to the merge map
 */
export function addToMergeMap<R extends Resource, K extends keyof R>(
  mergeMap: MergeMap<R>,
  key: K,
  value: R[K]
) {
  if (value == null) return;
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
  masterResource[key] = strategy(masterResourceValue, mergeValues);
}
