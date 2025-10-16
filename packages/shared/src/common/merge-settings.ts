import { cloneDeep, mergeWith, isPlainObject } from "lodash";

/**
 * Deep partial type that makes all properties optional recursively
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Generic utility to merge settings objects with proper deep merging behavior.
 * Merges new settings into old settings. If a new setting is undefined, the old value is used.
 * The old settings must be a full object, not a partial object.
 *
 * @param oldSettings The full old settings object
 * @param newSettings The partial new settings to merge in
 * @returns The merged settings object
 *
 */
export function mergeSettings<T>(oldSettings: T, newSettings?: DeepPartial<T>): T {
  if (!newSettings) return oldSettings;

  return mergeWith(cloneDeep(oldSettings), newSettings, (prev, next) => {
    if (next === undefined) return prev;
    if (Array.isArray(next)) return next;
    if (!isPlainObject(next)) return next;
    if (!isPlainObject(prev)) return next;
    return undefined;
  }) as T;
}
