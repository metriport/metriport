import { optionalStringPreprocess } from "@metriport/shared/util/zod";
import { z } from "zod";
import { periodSchema } from "./period";

// See: https://hl7.org/fhir/R4/valueset-identifier-use.html
export const identifierUseCodesSchema = z.enum(["usual", "official", "temp", "secondary", "old"]);
export type IdentifierUseCodes = z.infer<typeof identifierUseCodesSchema>;

export const strongIdentifierTypeCodesSchema = z.enum([
  "SS", // Social Security Number
  "DL", // Driver's license number
  "PPN", // Passport number
]);
export type StrongIdentifierTypeCodes = z.infer<typeof strongIdentifierTypeCodesSchema>;

export const regularIdentifierTypeCodesSchema = z.enum([
  "BRN", // Breed Registry Number
  "MR", // Medical record number
  "MCN", // Microchip Number
  "EN", // Employer number
  "TAX", // Tax ID number
  "NIIP", // National Insurance Payor Identifier (Payor)
  "PRN", // Provider number
  "MD", // Medical License number
  "DR", // Donor Registration Number
  "ACSN", // Accession ID
  "UDI", // Universal Device Identifier
  "SNO", // Serial Number
  "SB", // Social Beneficiary Identifier
  "PLAC", // Placer Identifier
  "FILL", // Filler Identifier
  "IAL2", // Identify proofing - see 11.1 on https://www.commonwellalliance.org/wp-content/uploads/2025/06/Services-Specification-v4.3-Approved-2025.06.03-1.pdf
  "IAL3", // Identify proofing - see 11.1 on https://www.commonwellalliance.org/wp-content/uploads/2025/06/Services-Specification-v4.3-Approved-2025.06.03-1.pdf
]);
const identifierTypeCodesSchema = z.enum([
  ...strongIdentifierTypeCodesSchema.options,
  ...regularIdentifierTypeCodesSchema.options,
] as const);
export type IdentifierTypeCodes = z.infer<typeof identifierTypeCodesSchema>;

export enum KnownIdentifierSystems {
  SSN = "http://hl7.org/fhir/sid/us-ssn",
  NPI = "http://hl7.org/fhir/sid/us-npi",
  URI = "urn:ietf:rfc:3986",
}

// An identifier intended for use external to the FHIR protocol. As an external identifier,
// it may be changed or retired due to human or system process and errors.
// See: https://specification.commonwellalliance.org/services/rest-api-reference (8.4.11 Identifier)
export const identifierSchema = z.object({
  /** Patient identifier that uniquely identifies the patient in the Edge System */
  value: z.string(),
  /** Assigning Authority ID for the unique Patient ID */
  system: z.string(),
  use: optionalStringPreprocess(identifierUseCodesSchema.nullish()),
  type: optionalStringPreprocess(identifierTypeCodesSchema.nullish()),
  assigner: optionalStringPreprocess(z.string().nullish()),
  period: periodSchema.nullish(),
});
export type Identifier = z.infer<typeof identifierSchema>;

export const strongIdSchema = identifierSchema
  .omit({
    system: true,
    value: true,
  })
  .merge(
    identifierSchema.required({
      system: true,
      value: true,
    })
  );
export type StrongId = z.infer<typeof strongIdSchema>;
