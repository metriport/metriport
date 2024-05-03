import * as z from "zod";
import {
  BaseResponse,
  documentReferenceSchema,
  baseResponseSchema,
  baseErrorResponseSchema,
  xcaGatewaySchema,
  DocumentReference,
} from "../shared";

// TO EXTERNAL GATEWAY
const inboundDocumentRetrievalRespSuccessfulSchema = baseResponseSchema.extend({
  documentReference: z.array(documentReferenceSchema),
});

export type InboundDocumentRetrievalRespSuccessful = z.infer<
  typeof inboundDocumentRetrievalRespSuccessfulSchema
>;

const inboundDocumentRetrievalRespFaultSchema = baseErrorResponseSchema;

export type InboundDocumentRetrievalRespFault = z.infer<
  typeof inboundDocumentRetrievalRespFaultSchema
>;

export const inboundDocumentRetrievalRespSchema = z.union([
  inboundDocumentRetrievalRespSuccessfulSchema,
  inboundDocumentRetrievalRespFaultSchema,
]);

export type InboundDocumentRetrievalResp = z.infer<typeof inboundDocumentRetrievalRespSchema>;

// FROM EXTERNAL GATEWAY
const outboundDocumentRetrievalRespSuccessfulSchema = baseResponseSchema.extend({
  gateway: xcaGatewaySchema,
  documentReference: z.array(documentReferenceSchema),
});

const outboundDocumentRetrievalRespFaultSchema = baseErrorResponseSchema.extend({
  gateway: xcaGatewaySchema,
  documentReference: z.never().or(z.literal(undefined)),
});

export const outboundDocumentRetrievalRespSchema = z.union([
  outboundDocumentRetrievalRespSuccessfulSchema,
  outboundDocumentRetrievalRespFaultSchema,
]);

export type OutboundDocumentRetrievalResp = z.infer<typeof outboundDocumentRetrievalRespSchema>;

export function isSuccessfulOutboundDocRetrievalResponse(
  obj: BaseResponse
): obj is OutboundDocumentRetrievalResp & { documentReference: DocumentReference[] } {
  return "documentReference" in obj;
}
