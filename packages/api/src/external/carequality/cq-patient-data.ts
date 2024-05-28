import { BaseDomain, BaseDomainCreate } from "@metriport/core/domain/base-domain";
import { InboundPatientResource } from "@metriport/ihe-gateway-sdk";

export type CQExternalPatient = {
  patientId: string;
  systemId: string;
  patientResource?: InboundPatientResource;
};

export type CQLinkedGateway = {
  oid: string;
  url: string;
};

export type CQLink = CQExternalPatient & CQLinkedGateway;

// leaving room for other info if needed
export type CQData = {
  links: CQLink[];
};

export interface CQPatientDataCreate extends BaseDomainCreate {
  cxId: string;
  data: CQData;
}

export interface CQPatientData extends BaseDomain, CQPatientDataCreate {}
