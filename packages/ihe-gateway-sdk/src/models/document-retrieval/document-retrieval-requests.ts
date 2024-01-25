import * as z from "zod";
import { documentReferenceSchema, baseRequestSchema, xcaGatewaySchema } from "../shared";

const documentRetrievalReqDefaultSchema = baseRequestSchema.extend({
  documentReference: z.array(documentReferenceSchema),
});

// TO EXTERNAL GATEWAY
export const documentRetrievalReqToExternalGWSchema = documentRetrievalReqDefaultSchema.extend({
  gateway: xcaGatewaySchema,
});

export type DocumentRetrievalReqToExternalGW = z.infer<
  typeof documentRetrievalReqToExternalGWSchema
>;

// FROM EXTERNAL GATEWAY
export const documentRetrievalReqFromExternalGWSchema = documentRetrievalReqDefaultSchema;

export type DocumentRetrievalReqFromExternalGW = z.infer<
  typeof documentRetrievalReqFromExternalGWSchema
>;
