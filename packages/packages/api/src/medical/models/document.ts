import { z } from "zod";

export const documentReferenceSchema = z.object({
  id: z.string(),
  fileName: z.string(),
  location: z.string(),
  description: z.string().optional(),
  status: z.string().optional(),
  indexed: z.string().optional(), // ISO-8601
  mimeType: z.string().optional(),
  size: z.number().optional(), // bytes
  type: z.object({
    coding: z
      .array(
        z.object({
          system: z.string().optional().nullable(),
          code: z.string().optional().nullable(),
          display: z.string().optional().nullable(),
        })
      )
      .optional(),
    text: z.string().optional(),
  }),
});
export type DocumentReference = z.infer<typeof documentReferenceSchema>;

export const documentListSchema = z.object({
  documents: z.array(documentReferenceSchema),
});
