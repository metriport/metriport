import * as z from "zod";
import {
  BaseResponse,
  documentReferenceSchema,
  baseResponseSchema,
  baseErrorResponseSchema,
  operationOutcomeSchema,
  xcaGatewaySchema,
  DocumentReference,
} from "../shared";

// TO EXTERNAL GATEWAY
const documentRetrievalRespToExternalGWSuccessfulSchema = baseResponseSchema.extend({
  documentReference: z.array(documentReferenceSchema),
  operationOutcome: operationOutcomeSchema.optional(),
});

const documentRetrievalRespToExternalGWFaultSchema = baseErrorResponseSchema;

export const documentRetrievalRespToExternalGWSchema = z.union([
  documentRetrievalRespToExternalGWSuccessfulSchema,
  documentRetrievalRespToExternalGWFaultSchema,
]);

export type DocumentRetrievalRespToExternalGW = z.infer<
  typeof documentRetrievalRespToExternalGWSchema
>;

// FROM EXTERNAL GATEWAY
const documentRetrievalRespFromExternalGWSuccessfulSchema = baseResponseSchema.extend({
  gateway: xcaGatewaySchema,
  documentReference: z.array(documentReferenceSchema),
  operationOutcome: operationOutcomeSchema.optional(),
});

const documentRetrievalRespFromExternalGWFaultSchema = baseErrorResponseSchema.extend({
  gateway: xcaGatewaySchema,
  documentReference: z.never(),
});

export const documentRetrievalRespFromExternalGWSchema = z.union([
  documentRetrievalRespFromExternalGWSuccessfulSchema,
  documentRetrievalRespFromExternalGWFaultSchema,
]);

export type DocumentRetrievalRespFromExternalGW = z.infer<
  typeof documentRetrievalRespFromExternalGWSchema
>;

export function isDocumentRetrievalResponse(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  obj: BaseResponse
): obj is DocumentRetrievalRespFromExternalGW & { documentReference: DocumentReference[] } {
  return "documentReference" in obj;
}
