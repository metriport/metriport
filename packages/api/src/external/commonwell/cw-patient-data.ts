import { BaseDomain, BaseDomainCreate } from "@metriport/core/domain/base-domain";
import { NetworkLink } from "@metriport/commonwell-sdk";

export type CwLink = NetworkLink;

// leaving room for other info if needed
export type CwData = {
  links: CwLink[];
};

export interface CwPatientDataCreate extends BaseDomainCreate {
  cxId: string;
  data: CwData;
}

export interface CwPatientData extends BaseDomain, CwPatientDataCreate {}
