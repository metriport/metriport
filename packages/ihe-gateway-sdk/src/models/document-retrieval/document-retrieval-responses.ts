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

const inboundDocumentRetrievalRespFaultSchema = baseErrorResponseSchema.extend({
  documentReference: z.never().or(z.literal(undefined)),
});

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
  requestedDocumentCount: z.number().optional(),
  originalRequestId: z.string().nullish(),
});

const outboundDocumentRetrievalRespFaultSchema = baseErrorResponseSchema.extend({
  gateway: xcaGatewaySchema,
  documentReference: z.never().or(z.literal(undefined)),
  requestedDocumentCount: z.number().optional(),
  originalRequestId: z.string().nullish(),
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

export function isSuccessfulInboundDocRetrievalResponse(
  obj: BaseResponse
): obj is InboundDocumentRetrievalResp & { documentReference: DocumentReference[] } {
  return "documentReference" in obj;
}

/** Safe context for logging/capture: no document content or patient identifiers. */
export function toSafeCaptureContext(
  response: OutboundDocumentRetrievalResp
): Record<string, unknown> {
  const { gateway } = response;
  return {
    id: response.id,
    requestChunkId: response.requestChunkId,
    timestamp: response.timestamp,
    responseTimestamp: response.responseTimestamp,
    requestTimestamp: response.requestTimestamp,
    duration: response.duration,
    responseHttpStatusCode: response.responseHttpStatusCode,
    documentReferenceCount: response.documentReference?.length ?? 0,
    requestedDocumentCount: response.requestedDocumentCount,
    originalRequestId: response.originalRequestId,
    gatewayHomeCommunityId: gateway?.homeCommunityId,
  };
}
