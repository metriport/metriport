import * as z from "zod";
import {
  BaseResponse,
  baseResponseSchema,
  baseErrorResponseSchema,
  xcaGatewaySchema,
  documentReferenceSchema,
  DocumentReference,
  dateRangeSchema,
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
  serviceDate: dateRangeSchema.optional(),
});

const documentQueryRespFromExternalFaultSchema = baseErrorResponseSchema.extend({
  documentReference: z.never().or(z.literal(undefined)),
  gateway: xcaGatewaySchema,
  serviceDate: dateRangeSchema.optional(),
});

export const outboundDocumentQueryRespSchema = z.union([
  documentQueryRespFromExternalSuccessfulSchema,
  documentQueryRespFromExternalFaultSchema,
]);

export type OutboundDocumentQueryResp = z.infer<typeof outboundDocumentQueryRespSchema>;

export function isSuccessfulOutboundDocQueryResponse(
  obj: BaseResponse
): obj is OutboundDocumentQueryResp & { documentReference: DocumentReference[] } {
  return "documentReference" in obj;
}
