import { FacilityType } from "@metriport/core/domain/facility";
import { Facility } from "../../../domain/medical/facility";
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
    cqApproved: boolean;
    cqActive: boolean;
    cwApproved: boolean;
    cwActive: boolean;
    ehexApproved: boolean;
    ehexActive: boolean;
    type: FacilityType;
    principalOid: string | null;
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
    cqApproved: facility.cqApproved,
    cqActive: facility.cqActive,
    cwApproved: facility.cwApproved,
    cwActive: facility.cwActive,
    ehexApproved: facility.ehexApproved,
    ehexActive: facility.ehexActive,
    type: facility.type,
    principalOid: facility.principalOid,
  };
}
