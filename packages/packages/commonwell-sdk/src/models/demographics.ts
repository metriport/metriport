import { z } from "zod";
import { isoDateTimeSchema } from "./iso-datetime";
import { identifierSchema } from "./identifier";
import { humanNameSchema } from "./human-name";
import { contactSchema } from "./contact";
import { addressSchema } from "./address";
import { isoDateSchema } from "./iso-date";

export enum GenderCodes {
  F = "F", // Female
  M = "M", // Male
  UN = "UN",
  UNK = "UNK",
}
export const genderCodesSchema = z.enum(Object.keys(GenderCodes) as [string, ...string[]]);

export const genderSchema = z.object({
  code: genderCodesSchema,
  display: z.string().optional().nullable(),
  system: z.string().optional().nullable(),
});

export type Gender = z.infer<typeof genderSchema>;

// The demographic details for a Person.
// See: https://specification.commonwellalliance.org/services/rest-api-reference (8.4.8 Demographics)
export const demographicsSchema = z.object({
  identifier: z.array(identifierSchema).optional().nullable(),
  name: z.array(humanNameSchema).min(1),
  telecom: z.array(contactSchema).optional().nullable(),
  gender: genderSchema,
  birthDate: isoDateTimeSchema.or(isoDateSchema),
  address: z.array(addressSchema),
  picture: z.any().optional().nullable(), // not supported
});

export type Demographics = z.infer<typeof demographicsSchema>;
