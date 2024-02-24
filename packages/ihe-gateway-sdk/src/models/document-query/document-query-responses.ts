import * as z from "zod";
import {
  BaseResponse,
  baseResponseSchema,
  baseErrorResponseSchema,
  xcaGatewaySchema,
  documentReferenceSchema,
  DocumentReference,
} from "../shared";

// TO EXTERNAL GATEWAY
const inboundDocumentQueryRespSuccessfulSchema = baseResponseSchema.extend({
  extrinsicObjectXmls: z.array(z.string()),
});

export type InboundDocumentQueryRespSuccessful = z.infer<
  typeof inboundDocumentQueryRespSuccessfulSchema
>;

const inboundDocumentQueryRespFaultSchema = baseErrorResponseSchema;

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
  documentReference: z.never(),
  gateway: xcaGatewaySchema,
});

export const outboundDocumentQueryRespSchema = z.union([
  documentQueryRespFromExternalSuccessfulSchema,
  documentQueryRespFromExternalFaultSchema,
]);

export type OutboundDocumentQueryResp = z.infer<typeof outboundDocumentQueryRespSchema>;

export function isOutboundDocumentQueryResponse(
  obj: BaseResponse
): obj is OutboundDocumentQueryResp & { documentReference: DocumentReference[] } {
  return "documentReference" in obj;
}
