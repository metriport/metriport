import { PatientDiscoveryResponseIncoming } from "@metriport/ihe-gateway-sdk";
import { BaseDomainCreate } from "@metriport/core/domain/base-domain";

export interface PatientDiscoveryResult extends BaseDomainCreate {
  requestId: string;
  status: string;
  createdAt: Date;
  data: PatientDiscoveryResponseIncoming;
}
