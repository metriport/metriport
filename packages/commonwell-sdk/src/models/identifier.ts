import { z } from "zod";
import { emptyStringToUndefinedSchema } from "../common/zod";
import { periodSchema } from "./period";

export enum KnownIdentifierSystems {
  SSN = "http://hl7.org/fhir/sid/us-ssn",
  NPI = "http://hl7.org/fhir/sid/us-npi",
  URI = "urn:ietf:rfc:3986",
}

const referenceInIdentifierSchema = z.object({
  reference: z.string().nullish(),
  type: z.string().nullish(),
  identifier: z.any().nullish(),
  display: z.string().nullish(),
});

export const patientIdentifierSchema = z.object({
  /** Patient identifier that uniquely identifies the patient in the Edge System */
  value: z.string(),
  /** Assigning Authority ID for the unique Patient ID */
  system: z.string(),
  use: emptyStringToUndefinedSchema.pipe(z.string().nullish()),
  type: emptyStringToUndefinedSchema.pipe(z.string().nullish()),
  assigner: emptyStringToUndefinedSchema,
  period: periodSchema.nullish(),
});
export type PatientIdentifier = z.infer<typeof patientIdentifierSchema>;

export const identifierSchema = z.object({
  value: z.string(),
  system: z.string().nullish(),
  use: emptyStringToUndefinedSchema.pipe(z.string().nullish()),
  type: emptyStringToUndefinedSchema.pipe(z.string().nullish()),
  assigner: referenceInIdentifierSchema.nullish(),
  period: periodSchema.nullish(),
});
export type Identifier = z.infer<typeof identifierSchema>;
