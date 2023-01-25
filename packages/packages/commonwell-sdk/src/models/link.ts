import { z } from "zod";
import { demographicsSchema } from "./demographics";

// A Link Object represents a hyperlink from the containing resource to a URI.
// See: https://specification.commonwellalliance.org/services/rest-api-reference (8.4.3 Address)
export const linkSchema = z.object({
  href: z.string(),
  templated: z.boolean().optional().nullable(),
  type: z.string().optional().nullable(),
});

export type Link = z.infer<typeof linkSchema>;

export const networkLinkSchema = z.array(
  z.object({
    _links: linkSchema.optional().nullable(),
    assuranceLevel: linkSchema.optional().nullable(),
    linkedPatient: z.object({
      details: demographicsSchema
    }).optional().nullable()
  })
)

export type NetworkLink = z.infer<typeof networkLinkSchema>;
