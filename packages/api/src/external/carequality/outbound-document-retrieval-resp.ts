import { BaseDomainCreate } from "@metriport/core/domain/base-domain";
import { OutboundDocumentRetrievalRespTableEntry } from "@metriport/core/external/carequality/ihe-gateway/outbound-result";

export interface OutboundDocumentRetrievalResp
  extends BaseDomainCreate,
    OutboundDocumentRetrievalRespTableEntry {}
