import { Resource } from "@medplum/fhirtypes";
import { MergeMap, MergeStrategy } from "./types";

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
