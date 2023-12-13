import { PatientDiscoveryResponse } from "@metriport/ihe-gateway-sdk";
import { BaseDomainCreate } from "../base-domain";

export interface PatientDiscoveryResult extends BaseDomainCreate {
  requestId: string;
  status: string;
  createdAt: Date;
  data: PatientDiscoveryResponse;
}
