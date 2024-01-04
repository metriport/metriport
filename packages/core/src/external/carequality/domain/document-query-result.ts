import { BaseResultDomain, BaseResponse, DocumentReference } from "./ihe-result";

export const TABLE_NAME = "document_query_result";
export const REQUEST_ID_COLUMN = "request_id";

export interface DocumentQueryResult extends BaseResultDomain {
  data: DocumentQueryResponse;
}

export type DocumentQueryResponse = BaseResponse & {
  documentReference: DocumentReference[];
  gateway: { homeCommunityId: string; url: string };
};
