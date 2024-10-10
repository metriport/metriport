import { BadRequestError } from "../../error/bad-request";
import { normalizeStateSafe, USState } from "./state";
import { normalizeTerritorySafe, USTerritory } from "./territory";

export type USStateForAddress = USState | USTerritory;

export function normalizeUSStateForAddress(value: string): USStateForAddress {
  const state = normalizeStateSafe(value) ?? normalizeTerritorySafe(value);
  if (!state) {
    throw new BadRequestError("Invalid US state or territory", undefined, {
      stateOrTerritory: value,
    });
  }
  return state;
}
