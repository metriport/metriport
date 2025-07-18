import { BaseDomain, BaseDomainCreate } from "./base-domain";
import { AddressStrict } from "./location-address";
import { TreatmentType } from "@metriport/shared";

/**
 * @deprecated Use shared's version instead.
 */
export enum OrganizationBizType {
  healthcareProvider = "healthcare_provider",
  healthcareITVendor = "healthcare_it_vendor",
}

export type OrganizationData = {
  name: string;
  shortcode?: string;
  type: TreatmentType;
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
