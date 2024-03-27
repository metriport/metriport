import {
  OutboundPatientDiscoveryResp as IHEOutboundPatientDiscoveryResp,
  OutboundDocumentQueryResp as IHEOutboundDocumentQueryResp,
  OutboundDocumentRetrievalResp as IHEOutboundDocumentRetrievalResp,
} from "@metriport/ihe-gateway-sdk";

export interface BaseResultDomain {
  requestId: string;
  status: string;
  createdAt: Date;
}

export interface OutboundPatientDiscoveryRespTableEntry extends BaseResultDomain {
  data: IHEOutboundPatientDiscoveryResp;
}
export interface OutboundDocumentQueryRespTableEntry extends BaseResultDomain {
  data: IHEOutboundDocumentQueryResp;
}

export interface OutboundDocumentRetrievalRespTableEntry extends BaseResultDomain {
  data: IHEOutboundDocumentRetrievalResp;
}
