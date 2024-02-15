import { OutboundPatientDiscoveryResp } from "@metriport/ihe-gateway-sdk";
import { BaseDomainCreate } from "@metriport/core/domain/base-domain";

export interface PatientDiscoveryResp extends BaseDomainCreate {
  requestId: string;
  status: string;
  createdAt: Date;
  data: OutboundPatientDiscoveryResp;
}
