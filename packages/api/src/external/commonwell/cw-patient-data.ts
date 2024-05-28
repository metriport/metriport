import { BaseDomain, BaseDomainCreate } from "@metriport/core/domain/base-domain";
import { NetworkLink } from "@metriport/commonwell-sdk";

// leaving room for other info if needed
export type CwData = {
  links: NetworkLink[];
};

export interface CwPatientDataCreate extends BaseDomainCreate {
  cxId: string;
  data: CwData;
}

export interface CwPatientData extends BaseDomain, CwPatientDataCreate {}
