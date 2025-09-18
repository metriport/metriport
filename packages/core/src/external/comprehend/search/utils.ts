import { CHARACTER_SET } from "./constants";

export function characterSetMap(initialValue = -1): number[] {
  return new Array(CHARACTER_SET.length).fill(initialValue);
}
