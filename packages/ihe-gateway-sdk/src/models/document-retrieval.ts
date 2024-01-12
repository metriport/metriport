import {
  BaseRequest,
  DocumentReference,
  BaseResponse,
  BaseErrorResponse,
  XCAGateway,
  documentReferenceSchema,
  baseRequestSchema,
  baseResponseSchema,
  baseErrorResponseSchema,
  xcaGatewaySchema,
} from "./shared";
import * as z from "zod";

export type DocumentRetrievalRequestOutgoing = BaseRequest & {
  cxId: string;
  gateway: XCAGateway;
  documentReference: DocumentReference[];
};

export const documentRetrievalResponseIncomingSchema = z.union([
  z.intersection(
    baseResponseSchema,
    z.object({
      documentReference: documentReferenceSchema.array(),
      gateway: xcaGatewaySchema,
    })
  ),
  baseErrorResponseSchema,
]);

export type DocumentRetrievalResponseIncoming = z.infer<
  typeof documentRetrievalResponseIncomingSchema
>;

export const documentRetrievalRequestIncomingSchema = baseRequestSchema.extend({
  documentReference: documentReferenceSchema.array(),
});
export type DocumentRetrievalRequestIncoming = z.infer<
  typeof documentRetrievalRequestIncomingSchema
>;

// DocumentReference is optional because the error response doesnt have it
export type DocumentRetrievalResponseOutgoing =
  | (BaseResponse & {
      documentReference: DocumentReference[];
    })
  | BaseErrorResponse;

export function isDocumentRetrievalResponse(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  obj: BaseResponse
): obj is DocumentRetrievalResponseIncoming & { documentReference: DocumentReference[] } {
  return "documentReference" in obj;
}
