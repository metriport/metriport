import { z } from "zod";
import { demographicsSchema } from "./demographics";

export enum LOLA {
  level_0 = "0",
  level_1 = "1",
  level_2 = "2",
  level_3 = "3",
  level_4 = "4",
}

export const lolaSchema = z.enum(Object.values(LOLA) as [string, ...string[]]);

// A Link Object represents a hyperlink from the containing resource to a URI.
// See: https://specification.commonwellalliance.org/services/rest-api-reference (8.4.3 Address)
export const linkSchema = z.object({
  href: z.string().optional().nullable(),
  templated: z.boolean().optional().nullable(),
  type: z.string().optional().nullable(),
});

export type Link = z.infer<typeof linkSchema>;

export const networkLinkSchema = z.object({
  _links: z
    .object({
      self: linkSchema.optional().nullable(),
      upgrade: linkSchema.optional().nullable(),
      downgrade: linkSchema.optional().nullable(),
    })
    .optional()
    .nullable(),
  assuranceLevel: lolaSchema.optional().nullable(),
  patient: z
    .object({
      details: demographicsSchema,
    })
    .optional()
    .nullable(),
});

export type NetworkLink = z.infer<typeof networkLinkSchema>;

export const patientLinkProxySchema = z.object({
  relationship: z.string().optional().nullable(),
  name: z.string().optional().nullable(),
});

export type PatientLinkProxy = z.infer<typeof patientLinkProxySchema>;
