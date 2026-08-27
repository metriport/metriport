import {
  OutboundPatientDiscoveryReq,
  OutboundDocumentQueryReq,
  OutboundDocumentRetrievalReq,
} from "@metriport/ihe-gateway-sdk";

export type PdRequestGatewayParams = {
  patientId: string;
  cxId: string;
  pdRequest: OutboundPatientDiscoveryReq;
};

export type DqRequestGatewayParams = {
  patientId: string;
  cxId: string;
  requestId?: string | undefined;
  dqRequests: OutboundDocumentQueryReq[];
};

export type DrRequestGatewayParams = {
  patientId: string;
  cxId: string;
  requestId?: string | undefined;
  drRequests: OutboundDocumentRetrievalReq[];
};

export abstract class EhexGateway {
  abstract startPatientDiscovery(params: PdRequestGatewayParams): Promise<void>;
  abstract startDocumentQueryGateway(params: DqRequestGatewayParams): Promise<void>;
  abstract startDocumentRetrievalGateway(params: DrRequestGatewayParams): Promise<void>;
}
