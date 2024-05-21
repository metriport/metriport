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

export interface OrganizationCreate extends BaseDomainCreate {
  cxId: string;
  oid: string;
  organizationNumber: number;
  type: OrganizationBizType;
  data: OrganizationData;
}

export interface Organization extends BaseDomain, OrganizationCreate {}

export function isHealthcareItVendor(type: OrganizationBizType) {
  return type === OrganizationBizType.healthcareITVendor;
}

export function isProvider(type: OrganizationBizType) {
  return type === OrganizationBizType.healthcareProvider;
}
