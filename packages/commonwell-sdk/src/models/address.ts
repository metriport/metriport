import { normalizeState } from "@metriport/shared";
import { z } from "zod";
import { emptyStringToUndefinedSchema } from "../common/zod";
import { periodSchema } from "./period";

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
  city: z.string().nullish(),
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
