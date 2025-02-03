import { PatientResource } from "@metriport/ihe-gateway-sdk";
import { BaseDomain, BaseDomainCreate } from "../../domain/base-domain";
import { LinkDemographicsHistory } from "../../domain/patient-demographics";

export type CQExternalPatient = {
  patientId: string;
  systemId: string;
  patientResource?: PatientResource;
};

export type CQLinkedGateway = {
  oid: string;
  url: string;
};

export type CQLink = CQExternalPatient & CQLinkedGateway;

// leaving room for other info if needed
export type CQData = {
  links: CQLink[];
  linkDemographicsHistory?: LinkDemographicsHistory;
};

export interface CQPatientDataCreate extends BaseDomainCreate {
  cxId: string;
  data: CQData;
}

export interface CQPatientDataCreatePartial extends BaseDomainCreate {
  cxId: string;
  data: Partial<CQData>;
}

export interface CQPatientData extends BaseDomain, CQPatientDataCreate {}
