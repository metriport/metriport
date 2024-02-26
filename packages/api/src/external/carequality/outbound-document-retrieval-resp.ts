import { OutboundDocumentRetrievalResp as OutboundDocumentRetrievalRespCore } from "@metriport/core/external/carequality/ihe-result";
import { BaseDomainCreate } from "@metriport/core/domain/base-domain";

export interface OutboundDocumentRetrievalResp
  extends BaseDomainCreate,
    OutboundDocumentRetrievalRespCore {}
