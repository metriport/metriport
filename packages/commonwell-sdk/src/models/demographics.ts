import { MetriportError } from "@metriport/shared";
import { zodToLowerCase } from "@metriport/shared/util/zod";
import { z } from "zod";
import { addressSchema } from "./address";
import { contactSchema } from "./contact";
import { humanNameSchema } from "./human-name";
import { patientIdentifierSchema } from "./identifier";
import { dateStringToIsoDateString, isoDateSchema, usDateSchema } from "./date";

/** @see https://hl7.org/fhir/R4/valueset-administrative-gender.html */
export enum GenderCodes {
  F = "female",
  M = "male",
  O = "other",
  U = "unknown",
}
export enum GenderCodesBackwardsCompatible {
  UN = "UN", // undifferentiated, convert to O
  UNKNOWN = "unknown",
  UNK = "unknown",
}
export const genderCodesSchema = z.preprocess(
  zodToLowerCase,
  z
    .nativeEnum(GenderCodes)
    .or(z.nativeEnum(GenderCodesBackwardsCompatible))
    .or(z.enum(Object.keys(GenderCodes).map(k => k.toLowerCase()) as [string, ...string[]]))
    .transform(coerceGender)
);
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

export function fhirGenderToCommonwell(gender: Gender): string {
  switch (gender) {
    case GenderCodes.F:
      return "F";
    case GenderCodes.M:
      return "M";
    case GenderCodes.O:
    case GenderCodesBackwardsCompatible.UN:
      return "O";
    case GenderCodes.U:
    case GenderCodesBackwardsCompatible.UNKNOWN:
    case GenderCodesBackwardsCompatible.UNK:
      return "U";
    default:
      throw new Error(`Unknown gender: ${gender}`);
  }
}

export function coerceGender(value: string): string {
  if (typeof value !== "string") throw new MetriportError(`Invalid gender`, undefined, { value });
  const v = value.toLowerCase();

  if (v === "f" || v === "female") return GenderCodes.F;
  if (v === "m" || v === "male") return GenderCodes.M;
  if (v === "o" || v === "other") return GenderCodes.O;
  if (v === "un" || v === "undifferentiated") return GenderCodes.O;
  if (v === "u" || v === "unk" || v === "unknown") return GenderCodes.U;

  throw new MetriportError(`Invalid gender`, undefined, { value });
}
