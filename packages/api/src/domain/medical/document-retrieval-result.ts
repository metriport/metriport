import { BaseResponse, DocumentReference } from "@metriport/ihe-gateway-sdk";
import { BaseResultDomain } from "./ihe-result";

export interface DocumentRetrievalResult extends BaseResultDomain {
  data: DocumentRetrievalResponse;
}

export type DocFileReference = DocumentReference & {
  newRepositoryUniqueId: string;
  newDocUniqueId: string;
  url: string;
};

export type DocumentRetrievalResponse = BaseResponse & {
  documentReference: DocFileReference[];
  gateway: { homeCommunityId: string; url: string };
};
