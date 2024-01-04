import { BaseResultDomain, BaseResponse, DocumentReference } from "./ihe-result";

export interface DocumentQueryResult extends BaseResultDomain {
  data: DocumentQueryResponse;
}

export type DocumentQueryResponse = BaseResponse & {
  documentReference: DocumentReference[];
  gateway: { homeCommunityId: string; url: string };
};
