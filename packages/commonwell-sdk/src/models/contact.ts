import { z } from "zod";
import { periodSchema } from "./period";

// How to use the contact/address. This value set defines its own terms in
// the system http://hl7.org/fhir/R4/valueset-contact-point-use.html.
// See: https://specification.commonwellalliance.org/appendix/terminology-bindings#c4-contact-use-codes
export enum ContactUseCodes {
  usual = "usual", // note that "usual" is not specified in the CW spec, but is in FHIR - may need review before use
  home = "home",
  work = "work",
  temp = "temp",
  old = "old",
  mobile = "mobile",
  unspecified = "unspecified", // note that "unspecified" is not specified in the CW spec, but is in FHIR - may need review before use
}
export const contactUseCodesSchema = z.enum(Object.keys(ContactUseCodes) as [string, ...string[]]);

// Describes the kind of contact. This value set defines its own terms in the
// system http://hl7.org/fhir/R4/valueset-contact-point-system.html.
// See: https://specification.commonwellalliance.org/appendix/terminology-bindings#c3-contact-system-codes
export enum ContactSystemCodes {
  phone = "phone",
  fax = "fax",
  email = "email",
  url = "url",
}
export const contactSystemCodesSchema = z.enum(
  Object.keys(ContactSystemCodes) as [string, ...string[]]
);

// A variety of technology-mediated contact details for a person or organization, including
// telephone, email, etc.
// See: https://specification.commonwellalliance.org/services/rest-api-reference (8.4.7 Contact)
export const contactSchema = z.object({
  use: contactUseCodesSchema.optional().nullable(),
  system: z.string().optional().nullable(),
  value: z.string().optional().nullable(),
  period: periodSchema.optional().nullable(),
});

export type Contact = z.infer<typeof contactSchema>;
