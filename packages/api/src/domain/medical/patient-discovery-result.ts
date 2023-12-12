import { PatientDiscoveryResponse } from "@metriport/ihe-gateway-sdk";
import { BaseDomain, BaseDomainCreate } from "../base-domain";

export interface PatientDiscoveryResultCreate extends BaseDomainCreate {
  requestId: string;
  status: string;
  data: PatientDiscoveryResponse;
}

export interface PatientDiscoveryResult extends BaseDomain, PatientDiscoveryResultCreate {}
