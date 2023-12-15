import { z } from "zod";
import { documentReferenceSchema } from "@metriport/api-sdk/medical/models/document";

const urlSchema = z.object({
  url: z.string(),
});
const documentBulkSignerLambdaResponseSchema = documentReferenceSchema.and(urlSchema);
export type DocumentBulkSignerLambdaResponse = z.infer<
  typeof documentBulkSignerLambdaResponseSchema
>;

export const documentBulkSignerLambdaResponseArraySchema = z.array(
  documentBulkSignerLambdaResponseSchema
);
