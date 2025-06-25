import { zodToLowerCase } from "@metriport/shared/util/zod";
import { z } from "zod";
import { addressSchema } from "./address";
import { contactSchema } from "./contact";
import { humanNameSchema } from "./human-name";
import { identifierSchema } from "./identifier";
import { isoDateSchema } from "./iso-date";

/** @see https://hl7.org/fhir/R4/valueset-administrative-gender.html */
export enum GenderCodes {
  F = "female",
  M = "male",
  O = "other",
  /* Undifferentiated: the gender of a person could not be uniquely defined as male or female, such as hermaphrodite. */
  UN = "UN",
  UNKNOWN = "unknown",
  UNK = "unknown",
}
export const genderCodesSchema = z.preprocess(
  zodToLowerCase,
  z
    .nativeEnum(GenderCodes)
    .or(z.enum(Object.keys(GenderCodes).map(k => k.toLowerCase()) as [string, ...string[]]))
);
export type Gender = z.infer<typeof genderCodesSchema>;

// The demographic details for a Person.
// See: https://specification.commonwellalliance.org/services/rest-api-reference (8.4.8 Demographics)
export const demographicsSchema = z.object({
  identifier: z.array(identifierSchema).min(1),
  name: z.array(humanNameSchema).min(1),
  gender: genderCodesSchema.nullish(),
  // TODO ENG-200 remove the isoDateTimeSchema option it's not in the spec
  // birthDate: isoDateSchema.or(isoDateTimeSchema),
  birthDate: isoDateSchema,
  address: z.array(addressSchema).min(1),
  telecom: z.array(contactSchema).nullish(),
});

export type Demographics = z.infer<typeof demographicsSchema>;
