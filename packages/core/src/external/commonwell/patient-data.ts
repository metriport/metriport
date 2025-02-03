import { NetworkLink } from "@metriport/commonwell-sdk";
import { BaseDomain, BaseDomainCreate } from "../../domain/base-domain";
import { LinkDemographicsHistory } from "../../domain/patient-demographics";

export type CwLink = NetworkLink;

// leaving room for other info if needed
export type CwData = {
  links: CwLink[];
  linkDemographicsHistory?: LinkDemographicsHistory;
};

export interface CwPatientDataCreate extends BaseDomainCreate {
  cxId: string;
  data: CwData;
}

export interface CwPatientDataCreatePartial extends BaseDomainCreate {
  cxId: string;
  data: Partial<CwData>;
}

export interface CwPatientData extends BaseDomain, CwPatientDataCreate {}
