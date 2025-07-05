import { optionalStringPreprocess, zodToLowerCase } from "@metriport/shared/util/zod";
import { z } from "zod";
import { periodSchema } from "./period";

/**
 * How to use the contact/address.
 * @see: https://hl7.org/fhir/R4/valueset-contact-point-use.html
 */
export enum ContactUseCodes {
  home = "home",
  work = "work",
  temp = "temp",
  old = "old",
  mobile = "mobile",
}
export const contactUseCodesSchema = z.preprocess(zodToLowerCase, z.nativeEnum(ContactUseCodes));

/**
 * Describes the kind of contact.
 * @see: https://hl7.org/fhir/R4/valueset-contact-point-system.html
 */
export enum ContactSystemCodes {
  phone = "phone",
  fax = "fax",
  email = "email",
  pager = "pager",
  url = "url",
  sms = "sms",
  other = "other",
}
export const contactSystemCodesSchema = z.nativeEnum(ContactSystemCodes);

// A variety of technology-mediated contact details for a person or organization, including
// telephone, email, etc.
// See: https://specification.commonwellalliance.org/services/rest-api-reference (8.4.7 Contact)
export const contactSchema = z.object({
  value: z.string().nullish(),
  system: z
    .string()
    .transform(zodToLowerCase)
    .transform(normalizeContactSystem)
    .pipe(contactSystemCodesSchema.nullish()),
  use: optionalStringPreprocess(contactUseCodesSchema.nullish()),
  period: periodSchema.nullish(),
});
export type Contact = z.infer<typeof contactSchema>;

function normalizeContactSystem(system: unknown): unknown {
  if (typeof system !== "string") return system;
  switch (system.toLowerCase()) {
    case "mobile":
      return "phone";
  }
  return system;
}
