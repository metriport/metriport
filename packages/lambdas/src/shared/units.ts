import {
  kbToMb as kbToMbFromCore,
  kbToMbString as kbToMbStringFromCore,
} from "@metriport/core/util/units";

/**
 * @deprecated Use `kbToMbString` from `@metriport/core/util/units` instead.
 */
export function kbToMbString(value: number) {
  return kbToMbStringFromCore(value);
}

/**
 * @deprecated Use `kbToMb` from `@metriport/core/util/units` instead.
 */
export function kbToMb(value: number) {
  return kbToMbFromCore(value);
}
