import { OutboundPatientDiscoveryResp as OutboundPatientDiscoveryRespCore } from "@metriport/ihe-gateway-sdk";
import { BaseDomainCreate } from "@metriport/core/domain/base-domain";

export interface OutboundPatientDiscoveryResp extends BaseDomainCreate {
  requestId: string;
  status: string;
  createdAt: Date;
  data: OutboundPatientDiscoveryRespCore;
}
