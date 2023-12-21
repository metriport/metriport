import { BaseResultDomain } from "./ihe-result";
import { BaseResponse, DocumentReference } from "@metriport/ihe-gateway-sdk";

export interface DocumentQueryResult extends BaseResultDomain {
  data: DocumentQueryResponse;
}

export type DocumentQueryResponse = BaseResponse & {
  documentReference: DocumentReference[];
  gateway: { homeCommunityId: string; url: string };
};
