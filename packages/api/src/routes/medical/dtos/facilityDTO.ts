import { Facility, FacilityType } from "../../../domain/medical/facility";
import { BaseDTO, toBaseDTO } from "./baseDTO";
import { AddressStrictDTO } from "./location-address-dto";

export type FacilityDTO = BaseDTO & {
  oid: string;
  name: string;
  npi: string;
  tin: string | undefined;
  active: boolean | undefined;
  address: AddressStrictDTO;
};

export type InternalFacilityDTO = BaseDTO &
  FacilityDTO & {
    oid: string;
    cqType: FacilityType;
    cqActive: boolean;
    cqOboOid: string | null;
    cwType: FacilityType;
    cwActive: boolean;
    cwOboOid: string | null;
  };

export function dtoFromModel(facility: Facility): FacilityDTO {
  const { name, npi, tin, active, address } = facility.data;
  return {
    ...toBaseDTO(facility),
    oid: facility.oid,
    name,
    npi,
    tin,
    active,
    address,
  };
}

export function internalDtoFromModel(facility: Facility): InternalFacilityDTO {
  const { name, npi, tin, active, address } = facility.data;
  return {
    ...toBaseDTO(facility),
    oid: facility.oid,
    name,
    npi,
    tin,
    active,
    address,
    cqType: facility.cqType,
    cqActive: facility.cqActive,
    cqOboOid: facility.cqOboOid,
    cwType: facility.cwType,
    cwActive: facility.cwActive,
    cwOboOid: facility.cwOboOid,
  };
}
