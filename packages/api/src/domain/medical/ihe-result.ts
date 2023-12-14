import {
  PatientDiscoveryResponse,
  DocumentQueryResponse,
  DocumentRetrievalResponse,
} from "@metriport/ihe-gateway-sdk";
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

export interface DocumentRetrievalResult extends BaseResultDomain {
  data: DocumentRetrievalResponse;
}
