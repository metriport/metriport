import {
  BaseRequest,
  DocumentReference,
  BaseResponse,
  BaseErrorResponse,
  XCAGateway,
} from "./shared";

export type DocumentRetrievalRequestOutgoing = BaseRequest & {
  cxId: string;
  gateway: XCAGateway;
  patientId: string;
  documentReference: DocumentReference[];
};

export type DocumentRetrievalResponseIncoming =
  | (BaseResponse & {
      documentReference: DocumentReference[];
      gateway: { homeCommunityId: string; url: string };
    })
  | BaseErrorResponse;

export type DocumentRetrievalRequestIncoming = BaseRequest & {
  documentReference: DocumentReference[];
};
// DocumentReference is optional because the error response doesnt have it
export type DocumentRetrievalResponseOutgoing =
  | (BaseResponse & {
      documentReference: DocumentReference[];
    })
  | BaseErrorResponse;

export function isDocumentRetrievalResponse(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  obj: any
): obj is DocumentRetrievalResponseIncoming & { documentReference: DocumentReference[] } {
  return "documentReference" in obj;
}
