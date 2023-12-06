import { documentReference, baseRequestSchema, baseResponseSchema } from "./shared";

import { z } from "zod";

export const documentRetrievalRequestSchema = z.array(
  baseRequestSchema.extend({
    gateway: z.object({
      xcaHomeCommunityId: z.string(),
      xcaUrl: z.string(),
    }),
    patientId: z.string(),
    documentReference: z.array(documentReference),
  })
);

export type DocumentRetrievalRequest = z.infer<typeof documentRetrievalRequestSchema>;

export const docFileReference = z.object({
  fileName: z.string(),
  docId: z.string(),
});

export const documentRetrievalResponseSchema = baseResponseSchema.extend({
  documentReference: z.array(docFileReference),
});

export type DocumentRetrievalResponse = z.infer<typeof documentRetrievalResponseSchema>;
