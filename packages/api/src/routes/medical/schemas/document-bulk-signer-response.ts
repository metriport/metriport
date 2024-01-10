import { z } from "zod";
import { documentReferenceSchema } from "@metriport/api-sdk/medical/models/document";

const urlSchema = z.object({
  url: z.string(),
});
const documentBulkSignerLambdaResponseSchema = documentReferenceSchema.and(urlSchema);

export const documentFromBulkSignerLambdaResponseArraySchema = z.array(
  documentBulkSignerLambdaResponseSchema
);
