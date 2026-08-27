import { TreatmentType } from "@metriport/shared/domain/organization";
import { BaseDomain, BaseDomainCreate } from "./base-domain";
import { AddressStrict } from "./location-address";

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
  ehexActive?: boolean;
  cqApproved?: boolean;
  cwApproved?: boolean;
  ehexApproved?: boolean;
  principalOid?: string | null;
  delegateOids?: string[];
}

export interface OrganizationRegister extends OrganizationCreate {
  id?: string;
}

export interface Organization extends BaseDomain, Required<OrganizationCreate> {
  oid: string;
  organizationNumber: number;
  principalOid: string | null;
  delegateOids: string[];
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

export function isDelegateOrganization(org: Organization): boolean;
export function isDelegateOrganization(principalOid: string | undefined): boolean;
export function isDelegateOrganization(
  orgOrPrincipalOid: Organization | string | undefined
): boolean {
  const principalOid =
    typeof orgOrPrincipalOid === "string" ? orgOrPrincipalOid : orgOrPrincipalOid?.principalOid;
  return !!principalOid;
}

export type ValidateOrgDelegationParams = {
  principalOid?: string | null;
  delegateOids?: string[];
};

/**
 * Validates that an organization cannot be both a delegate (has principalOid) and a principal (has delegateOids).
 */
export function validateOrgDelegation(params: ValidateOrgDelegationParams): void {
  const { principalOid, delegateOids } = params;
  const hasPrincipal = !!principalOid;
  const hasDelegates = delegateOids && delegateOids.length > 0;

  if (hasPrincipal && hasDelegates) {
    throw new Error(
      "Organization cannot have both principalOid and delegateOids. " +
        "An org is either a delegate (has principalOid) or a principal (has delegateOids), not both."
    );
  }
}
