import { BaseDomain, BaseDomainCreate } from "@metriport/core/domain/base-domain";
import { LinkDemographicsHistory } from "@metriport/core/domain/patient-demographics";
import { PatientResource } from "@metriport/ihe-gateway-sdk";

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

export interface CQPatientData extends BaseDomain, CQPatientDataCreate {}
