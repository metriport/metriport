import { BaseDomain, BaseDomainCreate } from "../base-domain";

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

export interface PatientCQDataCreate extends BaseDomainCreate {
  cxId: string;
  data: CQData;
}

export interface PatientCQData extends BaseDomain, PatientCQDataCreate {}
