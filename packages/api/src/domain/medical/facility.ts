import { BaseDomain, BaseDomainCreate } from "@metriport/core/domain/base-domain";
import { FacilityType } from "@metriport/core/domain/facility";
import { AddressStrict } from "@metriport/core/domain/location-address";
import { OIDNode } from "@metriport/core/domain/oid";
import { MedicalDataSource } from "@metriport/core/external/index";
import { MetriportError } from "@metriport/core/util/error/metriport-error";
import { Config } from "../../shared/config";

export type FacilityData = {
  name: string;
  npi: string;
  tin?: string;
  active?: boolean;
  address: AddressStrict;
};

export interface FacilityCreate extends Omit<BaseDomainCreate, "id"> {
  cxId: string;
  data: FacilityData;
  type: FacilityType;
  principalOid?: string | null;
  cqActive?: boolean;
  cwActive?: boolean;
  ehexActive?: boolean;
  cqApproved?: boolean;
  cwApproved?: boolean;
  ehexApproved?: boolean;
}

export interface Facility extends BaseDomain, Required<FacilityCreate> {
  oid: string;
  facilityNumber: number;
}

export function makeFacilityOid(orgNumber: number, facilityNumber: number) {
  return `${Config.getSystemRootOID()}.${OIDNode.organizations}.${orgNumber}.${
    OIDNode.locations
  }.${facilityNumber}`;
}

export function isInitiatorAndResponder(facility: Facility): boolean;
export function isInitiatorAndResponder(facilityType: FacilityType): boolean;
export function isInitiatorAndResponder(facilityOrType: Facility | FacilityType): boolean {
  const facilityType = typeof facilityOrType === "string" ? facilityOrType : facilityOrType.type;
  return facilityType === FacilityType.initiatorAndResponder;
}

export function isInitiatorOnly(facility: Facility): boolean;
export function isInitiatorOnly(facilityType: FacilityType): boolean;
export function isInitiatorOnly(facilityOrType: Facility | FacilityType): boolean {
  const facilityType = typeof facilityOrType === "string" ? facilityOrType : facilityOrType.type;
  return facilityType === FacilityType.initiatorOnly;
}

export function isDelegateFacility(facility: Facility): boolean;
export function isDelegateFacility(principalOid: string | null | undefined): boolean;
export function isDelegateFacility(
  facilityOrPrincipalOid: Facility | string | null | undefined
): boolean {
  const principalOid =
    typeof facilityOrPrincipalOid === "string"
      ? facilityOrPrincipalOid
      : facilityOrPrincipalOid?.principalOid;
  return !!principalOid;
}

export function isFacilityActiveForHie(facility: Facility, hie: MedicalDataSource): boolean {
  const { cwActive, cqActive, ehexActive } = facility;
  if (hie === MedicalDataSource.COMMONWELL) return !!cwActive;
  if (hie === MedicalDataSource.CAREQUALITY) return !!cqActive;
  if (hie === MedicalDataSource.EHEX) return !!ehexActive;
  throw new MetriportError("Programming error, invalid HIE type", undefined, { hie });
}
