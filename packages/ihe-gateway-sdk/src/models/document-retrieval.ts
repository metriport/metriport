import { BaseRequest, DocumentReference, baseResponseSchema } from "./shared";

import { z } from "zod";

export type DocumentRetrievalRequest = BaseRequest & {
  gateway: {
    xcaHomeCommunityId: string;
    xcaUrl: string;
  };
  patientId: string;
  documentReference: DocumentReference[];
};

export const docFileReference = z.object({
  fileName: z.string(),
  docId: z.string(),
});

export const documentRetrievalResponseSchema = baseResponseSchema.extend({
  documentReference: z.array(docFileReference),
});

export type DocumentRetrievalResponse = z.infer<typeof documentRetrievalResponseSchema>;
