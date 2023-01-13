import { z } from "zod";
import { demographicsSchema } from "./demographics";
import { enrollmentSummarySchema } from "./enrollment-summary";
import { linkSchema } from "./link";

export const personLinksSchema = z.object({
  self: linkSchema,
  patientLink: linkSchema.optional().nullable(),
  patientMatch: linkSchema.optional().nullable(),
  unenroll: linkSchema.optional().nullable(),
  enroll: linkSchema.optional().nullable(),
});

// The Person resource represents a natural person independent of a specific healthcare context.
// See: https://specification.commonwellalliance.org/services/rest-api-reference (8.6.6 Person)
export const personSchema = z.object({
  enrolled: z.boolean().optional().nullable(),
  enrollmentSummary: enrollmentSummarySchema.optional().nullable(),
  details: demographicsSchema,
  _links: personLinksSchema.optional().nullable(),
});

export type Person = z.infer<typeof personSchema>;

export const personSearchRespSchema = z.object({
  message: z.string(),
  _embedded: z.object({ person: z.array(personSchema) }),
  _links: z.object({ self: linkSchema }),
});

export type PersonSearchResp = z.infer<typeof personSearchRespSchema>;
