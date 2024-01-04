import { DocumentRetrievalResponseIncoming } from "@metriport/ihe-gateway-sdk";
import { BaseResultDomain } from "./ihe-result";

export interface DocumentRetrievalResult extends BaseResultDomain {
  data: DocumentRetrievalResponseIncoming;
}
