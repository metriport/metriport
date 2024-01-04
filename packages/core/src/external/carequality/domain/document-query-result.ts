import { DocumentQueryResponseOutgoing } from "@metriport/ihe-gateway-sdk";
import { BaseResultDomain } from "./ihe-result";

export const TABLE_NAME = "document_query_result";
export const REQUEST_ID_COLUMN = "request_id";

export interface DocumentQueryResult extends BaseResultDomain {
  data: DocumentQueryResponseOutgoing;
}
