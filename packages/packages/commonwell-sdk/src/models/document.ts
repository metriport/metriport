import { z } from "zod";
import { linkSchema, networkLinkSchema } from "./link";

// Example empty response
// {
//   "resourceType": "Bundle",
//   "entry": []
// }

export const documentSchema = z.object({
  self: linkSchema,
  networkLink: networkLinkSchema.optional().nullable(),
  person: linkSchema.optional().nullable(),
  personMatch: linkSchema.optional().nullable(),
  upgrade: linkSchema.optional().nullable(),
  downgrade: linkSchema.optional().nullable(),
});
export type Document = z.infer<typeof documentSchema>;

export const documentQueryResponseSchema = z.object({
  message: z.string().optional(),
  _embedded: z.object({ DocumentReference: z.array(documentSchema) }).optional(),
  _links: z.object({ self: linkSchema }),
});

export type DocumentQueryResponse = z.infer<typeof documentQueryResponseSchema>;
