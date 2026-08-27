import * as z from "zod";
import {
  baseErrorResponseSchema,
  BaseResponse,
  baseResponseSchema,
  DocumentReference,
  documentReferenceSchema,
  xcaGatewaySchema,
} from "../shared";

// TO EXTERNAL GATEWAY
const inboundDocumentQueryRespSuccessfulSchema = baseResponseSchema.extend({
  extrinsicObjectXmls: z.array(z.string()),
});

export type InboundDocumentQueryRespSuccessful = z.infer<
  typeof inboundDocumentQueryRespSuccessfulSchema
>;

const inboundDocumentQueryRespFaultSchema = baseErrorResponseSchema.extend({
  extrinsicObjectXmls: z.never().or(z.literal(undefined)),
});

export type InboundDocumentQueryRespFault = z.infer<typeof inboundDocumentQueryRespFaultSchema>;

export const inboundDocumentQueryRespSchema = z.union([
  inboundDocumentQueryRespSuccessfulSchema,
  inboundDocumentQueryRespFaultSchema,
]);

export type InboundDocumentQueryResp = z.infer<typeof inboundDocumentQueryRespSchema>;

// FROM EXTERNAL GATEWAY
const documentQueryRespFromExternalSuccessfulSchema = baseResponseSchema.extend({
  documentReference: z.array(documentReferenceSchema),
  gateway: xcaGatewaySchema,
});

const documentQueryRespFromExternalFaultSchema = baseErrorResponseSchema.extend({
  documentReference: z.never().or(z.literal(undefined)),
  gateway: xcaGatewaySchema,
});

export const outboundDocumentQueryRespSchema = z.union([
  documentQueryRespFromExternalSuccessfulSchema,
  documentQueryRespFromExternalFaultSchema,
]);
export type OutboundDocumentQueryResp = z.infer<typeof outboundDocumentQueryRespSchema>;

// TODO ENG-1692 Merge this and the same function from packages/api
export function isSuccessfulOutboundDocQueryResponse(
  obj: BaseResponse
): obj is OutboundDocumentQueryResp & { documentReference: DocumentReference[] } {
  return "documentReference" in obj;
}

/** Safe context for logging/capture: no document content or patient identifiers. */
export function toSafeCaptureContext(response: OutboundDocumentQueryResp): Record<string, unknown> {
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
    gatewayHomeCommunityId: gateway?.homeCommunityId,
  };
}
