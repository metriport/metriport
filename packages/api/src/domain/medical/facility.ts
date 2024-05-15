import { BaseDomain, BaseDomainCreate } from "@metriport/core/domain/base-domain";
import { AddressStrict } from "@metriport/core/domain/location-address";
import { OIDNode } from "@metriport/core/domain/oid";
import { MedicalDataSource } from "@metriport/core/external/index";
import { MetriportError } from "@metriport/core/util/error/metriport-error";
import { Config } from "../../shared/config";

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
  cqOboActive?: boolean;
  cwOboActive?: boolean;
  cqOboOid?: string | null;
  cwOboOid?: string | null;
  type?: FacilityType;
  data: FacilityData;
}

export interface FacilityRegister extends FacilityCreate {
  id?: string;
  cwFacilityName?: string;
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

export function isOboFacility(facilityType?: FacilityType): boolean {
  return facilityType === FacilityType.initiatorOnly;
}

export function isOboEnabled(facility: Facility, hie: MedicalDataSource): boolean {
  const { type, cwOboActive, cqOboActive, cwOboOid, cqOboOid } = facility;
  if (!isOboFacility(type)) return false;
  if (hie === MedicalDataSource.COMMONWELL) return !!cwOboActive && !!cwOboOid;
  if (hie === MedicalDataSource.CAREQUALITY) return !!cqOboActive && !!cqOboOid;
  throw new MetriportError("Programming error, invalid HIE type", undefined, { hie });
}
