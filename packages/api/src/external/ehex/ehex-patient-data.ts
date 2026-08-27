import { BaseDomain, BaseDomainCreate } from "@metriport/core/domain/base-domain";
import { LinkDemographicsHistory } from "@metriport/core/domain/patient-demographics";
import { PatientResource } from "@metriport/ihe-gateway-sdk";

export type EhexExternalPatient = {
  patientId: string;
  systemId: string;
  patientResource?: PatientResource;
};

export type EhexLinkedGateway = {
  id: string;
  oid: string;
  url: string;
};

export type EhexLink = EhexExternalPatient & EhexLinkedGateway;

export type EhexData = {
  links: EhexLink[];
  linkDemographicsHistory?: LinkDemographicsHistory;
};

export interface EhexPatientDataCreate extends BaseDomainCreate {
  cxId: string;
  data: EhexData;
}

export interface EhexPatientDataCreatePartial extends BaseDomainCreate {
  cxId: string;
  data: Partial<EhexData>;
}

export interface EhexPatientData extends BaseDomain, EhexPatientDataCreate {}
