import { BaseDomain, BaseDomainCreate } from "@metriport/core/domain/base-domain";
import { LinkDemographicsHistory } from "@metriport/core/domain/patient-demographics";
import { NetworkLink } from "@metriport/commonwell-sdk";

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
