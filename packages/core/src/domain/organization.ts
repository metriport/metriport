import { BaseDomain, BaseDomainCreate } from "./base-domain";
import { AddressStrict } from "./location-address";

export enum OrganizationBizType {
  healthcareProvider = "healthcare_provider",
  healthcareITVendor = "healthcare_it_vendor",
}

export enum OrgType {
  acuteCare = "acuteCare",
  ambulatory = "ambulatory",
  hospital = "hospital",
  labSystems = "labSystems",
  pharmacy = "pharmacy",
  postAcuteCare = "postAcuteCare",
}

export type OrganizationData = {
  name: string;
  type: OrgType;
  location: AddressStrict;
};

export interface OrganizationCreate extends BaseDomainCreate {
  cxId: string;
  oid: string;
  organizationNumber: number;
  type: OrganizationBizType;
  data: OrganizationData;
}

export interface Organization extends BaseDomain, OrganizationCreate {}
