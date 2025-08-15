import {
  dateStringToIsoDateString,
  isoDateSchema,
  MetriportError,
  usDateSchema,
} from "@metriport/shared";
import { z } from "zod";
import { addressSchema } from "./address";
import { contactSchema } from "./contact";
import { humanNameSchema } from "./human-name";
import { patientIdentifierSchema } from "./identifier";

/** @see https://hl7.org/fhir/R4/valueset-administrative-gender.html */
export enum GenderCodes {
  F = "F",
  M = "M",
  O = "O",
  U = "U", // Unknown
}
export const genderCodesSchema = z.preprocess(coerceGender, z.nativeEnum(GenderCodes));
export type Gender = z.infer<typeof genderCodesSchema>;

export const birthDateSchema = isoDateSchema.or(usDateSchema).transform(dateStringToIsoDateString);

// The demographic details for a Person.
// See: https://specification.commonwellalliance.org/services/rest-api-reference (8.4.8 Demographics)
export const demographicsSchema = z.object({
  identifier: z.array(patientIdentifierSchema).min(1),
  name: z.array(humanNameSchema).min(1),
  gender: genderCodesSchema.nullish(),
  birthDate: birthDateSchema,
  address: z.array(addressSchema).min(1),
  telecom: z.array(contactSchema).nullish(),
});
export type Demographics = z.infer<typeof demographicsSchema>;

export function coerceGender(value: unknown): GenderCodes {
  if (typeof value !== "string") {
    throw new MetriportError(`Invalid gender`, undefined, { value: String(value) });
  }
  const v = value.toLowerCase().trim();

  switch (v) {
    case "f":
    case "female":
      return GenderCodes.F;
    case "m":
    case "male":
      return GenderCodes.M;
    case "o":
    case "other":
    case "un":
    case "undifferentiated":
      return GenderCodes.O;
    case "u":
    case "unk":
    case "unknown":
      return GenderCodes.U;
    default:
      throw new MetriportError(`Invalid gender`, undefined, { value });
  }
}
