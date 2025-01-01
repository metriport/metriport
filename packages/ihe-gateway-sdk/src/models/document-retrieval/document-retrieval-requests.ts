import * as z from "zod";
import { documentReferenceSchema, baseRequestSchema, xcaGatewaySchema } from "../shared";

const documentRetrievalReqDefaultSchema = baseRequestSchema.extend({
  documentReference: z.array(documentReferenceSchema),
});

// TO EXTERNAL GATEWAY
export const outboundDocumentRetrievalReqSchema = documentRetrievalReqDefaultSchema.extend({
  gateway: xcaGatewaySchema,
  patientId: z.string(),
  cxId: z.string(),
});

export type OutboundDocumentRetrievalReq = z.infer<typeof outboundDocumentRetrievalReqSchema>;

// FROM EXTERNAL GATEWAY
export const inboundDocumentRetrievalReqSchema = documentRetrievalReqDefaultSchema;

export type InboundDocumentRetrievalReq = z.infer<typeof inboundDocumentRetrievalReqSchema>;
