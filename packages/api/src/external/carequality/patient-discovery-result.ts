import { PatientDiscoveryResponseIncoming } from "@metriport/ihe-gateway-sdk";
import { BaseDomainCreate } from "../../domain/base-domain";

export interface PatientDiscoveryResult extends BaseDomainCreate {
  requestId: string;
  status: string;
  createdAt: Date;
  data: PatientDiscoveryResponseIncoming;
}
