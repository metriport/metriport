import { z } from "zod";
import { periodSchema } from "./period";

// The use of an address. This value set defines its own terms in the
// system http://hl7.org/fhir/address-use.
// See: https://specification.commonwellalliance.org/appendix/terminology-bindings#c1-address-use-codes
export enum AddressUseCodes {
  home = "home",
  work = "work",
  temp = "temp",
  old = "old",
  unspecified = "unspecified",
}
export const addressUseCodesSchema = z.enum(Object.keys(AddressUseCodes) as [string, ...string[]]);

// A postal address.
// See: https://specification.commonwellalliance.org/services/rest-api-reference (8.4.3 Address)
export const addressSchema = z.object({
  use: addressUseCodesSchema.optional().nullable(),
  line: z.array(z.string()).optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  zip: z.string(),
  country: z.string().optional().nullable(),
  period: periodSchema.optional().nullable(),
});

export type Address = z.infer<typeof addressSchema>;
