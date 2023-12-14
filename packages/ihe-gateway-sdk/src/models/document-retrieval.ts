import {
  BaseRequest,
  DocumentReference,
  documentReferenceSchema,
  baseResponseSchema,
  BaseResponse,
  baseRequestSchema,
  XCAGateway,
} from "./shared";
import { z } from "zod";

// The following are for us creating a document retrieval request
export type DocumentRetrievalRequestOutgoing = BaseRequest & {
  cxId: string;
  gateway: XCAGateway;
  patientId: string;
  documentReference: DocumentReference[];
};

export const DocumentRetrievalResponseIncomingIncomingSchema = baseResponseSchema.extend({
  cxId: z.string(),
  documentReference: z.array(documentReferenceSchema),
});
export type DocumentRetrievalResponseIncoming = z.infer<
  typeof DocumentRetrievalResponseIncomingIncomingSchema
>;

// The following are for us responding to a document retrieval request
export const DocumentRetrievalRequestIncomingSchema = baseRequestSchema.extend({
  documentReference: z.array(documentReferenceSchema),
});
export type DocumentRetrievalRequestIncoming = z.infer<
  typeof DocumentRetrievalRequestIncomingSchema
>;

// DocumentReference is optional because the error response doesnt have it
export type DocumentRetrievalResponseOutgoing = BaseResponse & {
  documentReference?: DocumentReference[];
};
