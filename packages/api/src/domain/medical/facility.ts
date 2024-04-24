import { BaseDomain, BaseDomainCreate } from "@metriport/core/domain/base-domain";
import { AddressStrict } from "@metriport/core/domain/location-address";
import { OIDNode } from "@metriport/core/domain/oid";
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

export interface FacilityCreate extends BaseDomainCreate {
  cxId: string;
  oid: string;
  facilityNumber: number;
  cqOboActive: boolean;
  cwOboActive: boolean;
  // TODO 1706 try to make these undefined instead of null
  // TODO 1706 try to make these undefined instead of null
  // TODO 1706 try to make these undefined instead of null
  cqOboOid: string | null;
  cwOboOid: string | null;
  type: FacilityType;
  data: FacilityData;
}
export interface Facility extends BaseDomain, FacilityCreate {}

export function makeFacilityOid(orgNumber: number, facilityNumber: number) {
  return `${Config.getSystemRootOID()}.${OIDNode.organizations}.${orgNumber}.${
    OIDNode.locations
  }.${facilityNumber}`;
}

export function isOboFacility(facilityType: FacilityType) {
  return facilityType === FacilityType.initiatorOnly;
}
