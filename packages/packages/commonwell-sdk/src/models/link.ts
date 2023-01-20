import { z } from "zod";

// A Link Object represents a hyperlink from the containing resource to a URI.
// See: https://specification.commonwellalliance.org/services/rest-api-reference (8.4.3 Address)
export const linkSchema = z.object({
    href: z.string(),
    templated: z.boolean().optional().nullable(),
    type: z.string().optional().nullable(),
  });
  
  export type Link = z.infer<typeof linkSchema>;