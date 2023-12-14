import { PatientDiscoveryResponse, DocumentQueryResponse } from "@metriport/ihe-gateway-sdk";
import { BaseDomainCreate } from "../base-domain";

export interface BaseResultDomain extends BaseDomainCreate {
  requestId: string;
  status: string;
  createdAt: Date;
}

export interface PatientDiscoveryResult extends BaseResultDomain {
  data: PatientDiscoveryResponse;
}

export interface DocumentQueryResult extends BaseResultDomain {
  data: DocumentQueryResponse;
}
