import { OutboundDocumentQueryResp as OutboundDocumentQueryRespCore } from "@metriport/core/src/external/carequality/ihe-result";
import { BaseDomainCreate } from "@metriport/core/domain/base-domain";

export interface OutboundDocumentQueryResp
  extends BaseDomainCreate,
    OutboundDocumentQueryRespCore {}
