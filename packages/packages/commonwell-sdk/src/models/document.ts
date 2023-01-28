import { z } from "zod";
import { identifierUseCodesSchema } from "./identifier";
import { isoDateTimeSchema } from "./iso-datetime";
import { periodSchema } from "./period";

// Used as a reference, but not exactly the actual definition:
// https://specification.commonwellalliance.org/services/rest-api-reference#8610-documentreference

// TODO can this be an enum?
// Bundle, DocumentReference, Organization, Practitioner
const resourceTypeSchema = z.string().optional();

const docIdentifierSchema = z.object({
  use: identifierUseCodesSchema.optional(),
  system: z.string().optional(),
  value: z.string(),
});

const containedSchema = z.object({
  resourceType: resourceTypeSchema,
  id: z.string(),
  name: z.string().optional(),
  organization: z
    .object({
      reference: z.string(),
    })
    .optional(),
});

const statusSchema = z.enum(["current", "superceded", "entered in error"]);

// Main Clinical Acts Documented
const eventSchema = z.object({
  text: z.string(), // CodeableConcept
});

export const contentSchema = z.object({
  resourceType: resourceTypeSchema,
  contained: z.array(containedSchema),
  masterIdentifier: docIdentifierSchema,
  identifier: z.array(docIdentifierSchema).optional(),
  // diff structure from https://specification.commonwellalliance.org/services/rest-api-reference#8610-documentreference
  subject: z
    .object({
      reference: z.string(),
    })
    .optional(),
  type: z.object({
    coding: z.array(
      z.object({
        system: z.string().optional().nullable(),
        code: z.string().optional().nullable(),
        display: z.string().optional().nullable(),
      })
    ),
  }),
  author: z.array(
    z.object({
      reference: z.string(),
    })
  ),
  indexed: isoDateTimeSchema,
  status: statusSchema,
  // docStatus: preliminary | final | appended | amended | entered in error
  description: z.string().optional().nullable(),
  mimeType: z.string().optional().nullable(),
  location: z.string().optional(), // URL
  context: z.object({
    event: z.array(eventSchema),
    period: periodSchema,
  }),
});
export type DocumentContent = z.infer<typeof contentSchema>;

export const documentSchema = z.object({
  id: z.string(),
  content: contentSchema,
});
export type Document = z.infer<typeof documentSchema>;

export const documentQueryResponseSchema = z.object({
  resourceType: resourceTypeSchema,
  entry: z.array(documentSchema),
});

export type DocumentQueryResponse = z.infer<typeof documentQueryResponseSchema>;
