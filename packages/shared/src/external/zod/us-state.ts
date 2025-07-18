import { USStateForAddress, normalizeUSStateForAddressSafe } from "../..";

export function normalizeUsState(val: unknown): USStateForAddress | undefined {
  if (typeof val !== "string") throw new Error("Invalid state");
  return normalizeUSStateForAddressSafe(val);
}
