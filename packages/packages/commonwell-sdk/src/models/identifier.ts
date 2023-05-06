import { z } from "zod";
import { periodSchema } from "./period";

// Identifies the use for an identifier, if known. This value set defines its own
// terms in the system http://hl7.org/fhir/identifier-use
// See: https://specification.commonwellalliance.org/appendix/terminology-bindings#c8-identifier-use-codes
export const identifierUseCodesSchema = z.enum([
  "usual",
  "official",
  "temp",
  "secondary",
  "old",
  "unspecified",
]);

export type IdentifierUseCodes = z.infer<typeof identifierUseCodesSchema>;

// An identifier intended for use external to the FHIR protocol. As an external identifier,
// it may be changed or retired due to human or system process and errors.
// See: https://specification.commonwellalliance.org/services/rest-api-reference (8.4.11 Identifier)
export const identifierSchema = z.object({
  system: z.string(),
  key: z.string(),
  use: identifierUseCodesSchema.optional().nullable(),
  label: z.string().optional().nullable(),
  period: periodSchema.optional().nullable(),
  assigner: z.string().optional().nullable(),
});
export type Identifier = z.infer<typeof identifierSchema>;

export const strongIdSchema = identifierSchema
  .omit({
    system: true,
    key: true,
  })
  .merge(
    identifierSchema.required({
      system: true,
      key: true,
    })
  );
export type StrongId = z.infer<typeof strongIdSchema>;
