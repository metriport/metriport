import { BaseDomain, BaseDomainCreate } from "../../../domain/base-domain";

export type CQExternalPatient = {
  patientId: string;
  systemId: string;
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
