import { OutboundDocumentQueryRespTableEntry } from "@metriport/core/external/carequality/ihe-gateway-v1/outbound-result";
import { BaseDomainCreate } from "@metriport/core/domain/base-domain";

export interface OutboundDocumentQueryResp
  extends BaseDomainCreate,
    OutboundDocumentQueryRespTableEntry {}
