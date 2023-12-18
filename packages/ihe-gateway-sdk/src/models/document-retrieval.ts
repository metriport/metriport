import { BaseRequest, DocumentReference } from "./shared";

export type DocumentRetrievalRequest = BaseRequest & {
  gateway: {
    xcaHomeCommunityId: string;
    xcaUrl: string;
  };
  patientId: string;
  documentReference: DocumentReference[];
};
