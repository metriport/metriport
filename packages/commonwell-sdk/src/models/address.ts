import { normalizeState, normalizeStateSafe } from "@metriport/shared";
import { z } from "zod";
import { emptyStringToUndefinedSchema } from "../common/zod";
import { periodSchema } from "./period";

const MIN_LINE_LENGTH = 3;
const MIN_CITY_LENGTH = 3;

/**
 * The use of an address.
 * @see: https://hl7.org/fhir/R4/valueset-address-use.html
 */
export enum AddressUseCodes {
  home = "home",
  work = "work",
  temp = "temp",
  old = "old",
  billing = "billing",
}

export enum AddressTypeCodes {
  postal = "postal",
  physical = "physical",
  both = "both",
}

// A postal address.
// See: https://specification.commonwellalliance.org/services/rest-api-reference (8.4.3 Address)
export const addressSchema = z.object({
  line: z.array(z.string()).nullish(),
  city: emptyStringToUndefinedSchema,
  state: z.preprocess(normalizeStatePreprocess, z.string().nullish()),
  country: emptyStringToUndefinedSchema,
  postalCode: emptyStringToUndefinedSchema.pipe(z.string().nullish()),
  use: emptyStringToUndefinedSchema.pipe(z.string().nullish()),
  type: emptyStringToUndefinedSchema.pipe(z.string().nullish()),
  period: periodSchema.nullish(),
});
export type Address = z.infer<typeof addressSchema>;

export function normalizeStatePreprocess(arg: unknown): unknown {
  if (typeof arg === "string" && ["", "undefined", "null"].includes(arg.trim())) return undefined;
  if (typeof arg === "string") return normalizeState(arg);
  return undefined;
}

// Safe address schema that filters out invalid addresses instead of throwing errors
export const addressSchemaSafe = z.object({
  line: z.array(z.string()).nullish(),
  city: z.string().nullish(),
  state: z.preprocess(normalizeStatePreprocessSafe, emptyStringToUndefinedSchema),
  country: emptyStringToUndefinedSchema,
  postalCode: emptyStringToUndefinedSchema.pipe(z.string().nullish()),
  use: emptyStringToUndefinedSchema.pipe(z.string().nullish()),
  type: emptyStringToUndefinedSchema.pipe(z.string().nullish()),
  period: periodSchema.nullish(),
});

export function normalizeStatePreprocessSafe(arg: unknown): unknown {
  if (typeof arg === "string") return normalizeStateSafe(arg);
  return arg;
}

// Safe address array schema that filters out invalid addresses
export const addressArraySchemaSafe = z.array(addressSchemaSafe).transform(addresses => {
  return addresses.filter(address => isValidAddress(address));
});

/**
 * Validates if an address meets all minimum requirements
 */
function isValidAddress(address: Address): boolean {
  return (
    isValidAddressLine(address.line) && isValidCity(address.city) && isValidState(address.state)
  );
}

/**
 * Validates if an address line has sufficient content
 */
function isValidAddressLine(line: string[] | null | undefined): boolean {
  if (!line || line.length < 1) return false;
  return line.some(lineItem => lineItem.trim().length >= MIN_LINE_LENGTH);
}

/**
 * Validates if a city has sufficient content
 */
function isValidCity(city: string | null | undefined): boolean {
  if (!city) return false;
  return city.trim().length >= MIN_CITY_LENGTH;
}

/**
 * Validates if a state is a legitimate US state
 */
function isValidState(state: string | null | undefined): boolean {
  if (!state) return false;
  return normalizeStateSafe(state) !== undefined;
}
