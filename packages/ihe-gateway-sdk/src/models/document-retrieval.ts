import { BaseRequest, DocumentReference, baseResponseSchema, documentReference } from "./shared";

import { z } from "zod";

export type DocumentRetrievalRequest = BaseRequest & {
  gateway: {
    xcaHomeCommunityId: string;
    xcaUrl: string;
  };
  patientId: string;
  documentReference: DocumentReference[];
};

export const docFileReference = documentReference.extend({
  newRepositoryUniqueId: z.string(),
  newDocUniqueId: z.string(),
  url: z.string(),
});

export const documentRetrievalResponseSchema = baseResponseSchema.extend({
  documentReference: z.array(docFileReference),
  gateway: z.object({ homeCommunityId: z.string(), url: z.string() }),
});

export type DocumentRetrievalResponse = z.infer<typeof documentRetrievalResponseSchema>;
