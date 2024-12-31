import { BaseDomain, BaseDomainCreate } from "./base-domain";
import { AddressStrict } from "./location-address";

export enum OrganizationBizType {
  healthcareProvider = "healthcare_provider",
  healthcareITVendor = "healthcare_it_vendor",
}

/**
 * @deprecated Should no longer be used. Use TreatmentType instead.
 */
export enum OrgType {
  acuteCare = "acuteCare",
  ambulatory = "ambulatory",
  hospital = "hospital",
  labSystems = "labSystems",
  pharmacy = "pharmacy",
  postAcuteCare = "postAcuteCare",
}

// TODO: Update all instances of OrgType to TreatmentType
export enum TreatmentType {
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

export interface OrganizationCreate extends Omit<BaseDomainCreate, "id"> {
  cxId: string;
  type?: OrganizationBizType;
  data: OrganizationData;
  cqActive?: boolean;
  cwActive?: boolean;
  cqApproved?: boolean;
  cwApproved?: boolean;
}

export interface OrganizationRegister extends OrganizationCreate {
  id?: string;
}

export interface Organization extends BaseDomain, Required<OrganizationCreate> {
  oid: string;
  organizationNumber: number;
}

export function isHealthcareItVendor(type: OrganizationBizType): boolean;
export function isHealthcareItVendor(type: Organization): boolean;
export function isHealthcareItVendor(param: OrganizationBizType | Organization): boolean {
  const type = typeof param === "string" ? param : param.type;
  return type === OrganizationBizType.healthcareITVendor;
}

export function isProvider(type: OrganizationBizType): boolean;
export function isProvider(type: Organization): boolean;
export function isProvider(param: OrganizationBizType | Organization): boolean {
  const type = typeof param === "string" ? param : param.type;
  return type === OrganizationBizType.healthcareProvider;
}
