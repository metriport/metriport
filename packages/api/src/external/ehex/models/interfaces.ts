import {
  OutboundDocumentQueryResp as IHEOutboundDocumentQueryResp,
  OutboundDocumentRetrievalResp as IHEOutboundDocumentRetrievalResp,
} from "@metriport/ihe-gateway-sdk";
import { EhexOutboundPatientDiscoveryResp as EhexOutboundPatientDiscoveryRespCore } from "@metriport/core/external/ehex/ehex-gateway/outbound/xcpd/process/types";
import { BaseDomainCreate } from "@metriport/shared/domain/base-domain";

export interface BaseResultDomain extends BaseDomainCreate {
  requestId: string;
  status: string;
  createdAt: Date;
}

export interface EhexOutboundPatientDiscoveryResp extends BaseResultDomain {
  data: EhexOutboundPatientDiscoveryRespCore;
}

export interface EhexOutboundDocumentQueryResp extends BaseResultDomain {
  data: IHEOutboundDocumentQueryResp;
}

export interface EhexOutboundDocumentRetrievalResp extends BaseResultDomain {
  data: IHEOutboundDocumentRetrievalResp;
}
