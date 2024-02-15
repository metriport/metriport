import {
  OutboundDocumentQueryResp as IHEOutboundDocumentQueryResp,
  OutboundDocumentRetrievalResp as IHEOutboundDocumentRetrievalResp,
} from "@metriport/ihe-gateway-sdk";

export const REQUEST_ID_COLUMN = "request_id";
export const DOC_QUERY_RESULT_TABLE_NAME = "document_query_result";
export const DOC_RETRIEVAL_RESULT_TABLE_NAME = "document_retrieval_result";

export interface BaseResultDomain {
  requestId: string;
  status: string;
  createdAt: Date;
}

export interface OutboundDocumentQueryResp extends BaseResultDomain {
  data: IHEOutboundDocumentQueryResp;
}

export interface OutboundDocumentRetrievalResp extends BaseResultDomain {
  data: IHEOutboundDocumentRetrievalResp;
}
