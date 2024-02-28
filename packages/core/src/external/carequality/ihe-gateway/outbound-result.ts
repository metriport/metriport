import {
  OutboundDocumentQueryResp as IHEOutboundDocumentQueryResp,
  OutboundDocumentRetrievalResp as IHEOutboundDocumentRetrievalResp,
} from "@metriport/ihe-gateway-sdk";

export interface BaseResultDomain {
  requestId: string;
  status: string;
  createdAt: Date;
}

export interface OutboundDocumentQueryRespTableEntry extends BaseResultDomain {
  data: IHEOutboundDocumentQueryResp;
}

export interface OutboundDocumentRetrievalRespTableEntry extends BaseResultDomain {
  data: IHEOutboundDocumentRetrievalResp;
}
