import {
  DocumentQueryRespFromExternalGW,
  DocumentRetrievalRespFromExternalGW,
} from "@metriport/ihe-gateway-sdk";

export const REQUEST_ID_COLUMN = "request_id";
export const DOC_QUERY_RESULT_TABLE_NAME = "document_query_result";
export const DOC_RETRIEVAL_RESULT_TABLE_NAME = "document_retrieval_result";

export interface BaseResultDomain {
  requestId: string;
  status: string;
  createdAt: Date;
}

export interface IHEToExternalGwDocumentQuery extends BaseResultDomain {
  data: DocumentQueryRespFromExternalGW;
}

export interface IHEToExternalGwDocumentRetrieval extends BaseResultDomain {
  data: DocumentRetrievalRespFromExternalGW;
}
