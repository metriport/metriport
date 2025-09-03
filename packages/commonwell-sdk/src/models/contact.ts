import { zodToLowerCase } from "@metriport/shared";
import { z } from "zod";
import { emptyStringToUndefinedSchema } from "../common/zod";
import { periodSchema } from "./period";

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
export const contactSystemCodesSchema = z
  .string()
  .transform(zodToLowerCase)
  .transform(normalizeContactSystem)
  .pipe(z.nativeEnum(ContactSystemCodes));

function normalizeContactSystem(system: unknown): unknown {
  if (typeof system !== "string") return system;
  switch (system.toLowerCase()) {
    case "mobile":
      return "phone";
  }
  return system;
}

// A variety of technology-mediated contact details for a person or organization, including
// telephone, email, etc.
// See: https://specification.commonwellalliance.org/services/rest-api-reference (8.4.7 Contact)
export const contactSchema = z.object({
  value: z.string().nullish(),
  system: emptyStringToUndefinedSchema.pipe(contactSystemCodesSchema.nullish()),
  use: emptyStringToUndefinedSchema.pipe(z.string().nullish()),
  period: periodSchema.nullish(),
});
export type Contact = z.infer<typeof contactSchema>;
