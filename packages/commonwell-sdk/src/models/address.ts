import { zodToLowerCase } from "@metriport/shared";
import { z } from "zod";
import { emptyStringToUndefinedSchema } from "../common/zod";
import { periodSchema } from "./period";

/**
 * The use of an address.
 * @see: https://hl7.org/fhir/R4/valueset-address-use.html
 */
export enum AddressUseCodes {
  home = "home",
  old = "old",
}
export const addressUseCodesSchema = z.preprocess(zodToLowerCase, z.nativeEnum(AddressUseCodes));

export enum AddressTypeCodes {
  postal = "postal",
  physical = "physical",
  both = "both",
}
export const addressTypeCodesSchema = z.preprocess(zodToLowerCase, z.nativeEnum(AddressTypeCodes));

// A postal address.
// See: https://specification.commonwellalliance.org/services/rest-api-reference (8.4.3 Address)
export const addressSchema = z.object({
  line: z.array(z.string()).nullish(),
  city: z.string().nullish(),
  state: z.string().nullish(),
  country: emptyStringToUndefinedSchema,
  postalCode: z.string(),
  use: emptyStringToUndefinedSchema.pipe(addressUseCodesSchema.nullish()),
  type: emptyStringToUndefinedSchema.pipe(addressTypeCodesSchema.nullish()),
  period: periodSchema.nullish(),
});

export type Address = z.infer<typeof addressSchema>;
