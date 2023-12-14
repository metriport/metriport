import { BaseResultDomain, baseResponseSchema, documentReference } from "./ihe-result";
import { z } from "zod";

export interface DocumentQueryResult extends BaseResultDomain {
  data: DocumentQueryResponse;
}

export const documentQueryResponseSchema = baseResponseSchema.extend({
  documentReference: z.array(documentReference).nullish(),
  gateway: z.object({ homeCommunityId: z.string(), url: z.string() }),
});

export type DocumentQueryResponse = z.infer<typeof documentQueryResponseSchema>;
