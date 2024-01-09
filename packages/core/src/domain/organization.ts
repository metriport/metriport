import { BaseDomain, BaseDomainCreate } from "./base-domain";
import { AddressStrict } from "./location-address";

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
  data: OrganizationData;
}

export interface Organization extends BaseDomain, OrganizationCreate {}
