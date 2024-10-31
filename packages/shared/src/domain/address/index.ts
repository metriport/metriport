import { z } from "zod";
import { BadRequestError } from "../../error/bad-request";
import { createNonEmptryStringSchema } from "../../common/string";
import { normalizeStateSafe, USState, usStateSchema } from "./state";
import { normalizeTerritorySafe, USTerritory, usTerritorySchema } from "./territory";
import { zipSchema } from "./zip";
import { geoCoordinateSchema } from "./geo";
import { countrySchema } from "./country";

export type USStateForAddress = USState | USTerritory;

export function normalizeUSStateForAddressSafe(value: string): USStateForAddress | undefined {
  return normalizeStateSafe(value) ?? normalizeTerritorySafe(value);
}

export function normalizeUSStateForAddress(value: string): USStateForAddress {
  const state = normalizeStateSafe(value) ?? normalizeTerritorySafe(value);
  if (!state) {
    throw new BadRequestError("Invalid US state or territory", undefined, {
      stateOrTerritory: value,
    });
  }
  return state;
}

export const usStateForAddressSchema = usStateSchema.or(usTerritorySchema);

export const addressSchema = z.object({
  addressLine1: createNonEmptryStringSchema("addressLine1"),
  addressLine2: createNonEmptryStringSchema("addressLine2").optional(),
  city: createNonEmptryStringSchema("city"),
  state: usStateForAddressSchema,
  zip: zipSchema,
  coordinates: geoCoordinateSchema.optional(),
  country: countrySchema,
});
