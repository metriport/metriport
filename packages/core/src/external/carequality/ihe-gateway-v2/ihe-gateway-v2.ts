import {
  OutboundPatientDiscoveryReq,
  OutboundDocumentQueryReq,
  OutboundDocumentRetrievalReq,
} from "@metriport/ihe-gateway-sdk";

export type PDRequestGatewayV2Params = {
  patientId: string;
  cxId: string;
  pdRequestGatewayV2: OutboundPatientDiscoveryReq;
};

export type DQRequestGatewayV2Params = {
  patientId: string;
  cxId: string;
  dqRequestsGatewayV2: OutboundDocumentQueryReq[];
};

export type DRRequestGatewayV2Params = {
  patientId: string;
  cxId: string;
  drRequestsGatewayV2: OutboundDocumentRetrievalReq[];
};

export abstract class IHEGatewayV2 {
  abstract startPatientDiscovery(params: PDRequestGatewayV2Params): Promise<void>;
  abstract startDocumentQueryGatewayV2(params: DQRequestGatewayV2Params): Promise<void>;
  abstract startDocumentRetrievalGatewayV2(params: DRRequestGatewayV2Params): Promise<void>;
}
