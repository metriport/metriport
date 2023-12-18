import { BaseRequest, DocumentReference, BaseResponse, XCAGateway } from "./shared";

// The following are for us creating a document retrieval request
export type DocumentRetrievalRequestOutgoing = BaseRequest & {
  cxId: string;
  gateway: XCAGateway;
  patientId: string;
  documentReference: DocumentReference[];
};

// The following are for us responding to a document retrieval request
export type DocumentRetrievalRequestIncoming = BaseRequest & {
  documentReference: DocumentReference[];
};
// DocumentReference is optional because the error response doesnt have it
export type DocumentRetrievalResponseOutgoing = BaseResponse & {
  documentReference?: DocumentReference[];
};
