import { OutboundPatientDiscoveryReq } from "@metriport/ihe-gateway-sdk";

export type PDRequestGatewayV2Params = {
  patientId: string;
  cxId: string;
  pdRequestGatewayV2: OutboundPatientDiscoveryReq;
};

export abstract class IHEGatewayV2 {
  abstract startPatientDiscoveryGatewayV2(params: PDRequestGatewayV2Params): Promise<void>;
}
