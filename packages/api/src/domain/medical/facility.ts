import { BaseDomain, BaseDomainCreate } from "@metriport/core/domain/base-domain";
import { AddressStrict } from "@metriport/core/domain/location-address";
import { OIDNode } from "@metriport/core/domain/oid";
import { MedicalDataSource } from "@metriport/core/external/index";
import { MetriportError } from "@metriport/core/util/error/metriport-error";
import { Config } from "../../shared/config";

/**
 * @deprecated use @metriport/core/src/domain/facility instead
 */
export enum FacilityType {
  initiatorAndResponder = "initiator_and_responder",
  initiatorOnly = "initiator_only",
}

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
  cqActive?: boolean;
  cwActive?: boolean;
  cqOboOid?: string | null;
  cwOboOid?: string | null;
  cwType?: FacilityType;
  cqType?: FacilityType;
  cqApproved?: boolean;
  cwApproved?: boolean;
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

/**
 * @deprecated use isInitiatorOnly instead
 */
export function isOboFacility(facilityType?: FacilityType): boolean {
  return facilityType === FacilityType.initiatorOnly;
}

/**
 * @deprecated use isInitiatorAndResponder instead
 */
export function isNonOboFacility(facilityType?: FacilityType): boolean {
  return facilityType === FacilityType.initiatorAndResponder;
}

export function isInitiatorAndResponder(facility: Facility): boolean;
export function isInitiatorAndResponder(facilityType: FacilityType): boolean;
export function isInitiatorAndResponder(facilityOrType: Facility | FacilityType): boolean {
  const facilityType = typeof facilityOrType === "string" ? facilityOrType : facilityOrType.cwType;
  return facilityType === FacilityType.initiatorAndResponder;
}

export function isInitiatorOnly(facility: Facility): boolean;
export function isInitiatorOnly(facilityType: FacilityType): boolean;
export function isInitiatorOnly(facilityOrType: Facility | FacilityType): boolean {
  const facilityType = typeof facilityOrType === "string" ? facilityOrType : facilityOrType.cwType;
  return !isInitiatorAndResponder(facilityType);
}

export function isFacilityActiveForHie(facility: Facility, hie: MedicalDataSource): boolean {
  const { cwActive, cqActive } = facility;
  if (hie === MedicalDataSource.COMMONWELL) return !!cwActive;
  if (hie === MedicalDataSource.CAREQUALITY) return !!cqActive;
  throw new MetriportError("Programming error, invalid HIE type", undefined, { hie });
}
