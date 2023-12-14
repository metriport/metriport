import { BaseResultDomain, baseResponseSchema, documentReference } from "./ihe-result";
import { z } from "zod";

export interface DocumentRetrievalResult extends BaseResultDomain {
  data: DocumentRetrievalResponse;
}

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
