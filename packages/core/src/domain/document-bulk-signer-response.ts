import { z } from "zod";
import { documentReferenceSchema } from "@metriport/api-sdk/medical/models/document";

const urlSchema = z.object({
  url: z.string(),
});
const DocumentBulkSignerLambdaResponseSchema = documentReferenceSchema.and(urlSchema);
export type DocumentBulkSignerLambdaResponse = z.infer<
  typeof DocumentBulkSignerLambdaResponseSchema
>;

export const DocumentBulkSignerLambdaResponseArraySchema = z.array(
  DocumentBulkSignerLambdaResponseSchema
);
