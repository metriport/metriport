import { Facility } from "../../../domain/medical/facility";
import { BaseDTO, toBaseDTO } from "./baseDTO";
import { AddressStrictDTO } from "./location-address-dto";
import { FacilityType } from "../../../domain/medical/facility";

export type FacilityDTO = BaseDTO & {
  id: string;
  name: string;
  npi: string;
  tin: string | undefined;
  active: boolean | undefined;
  address: AddressStrictDTO;
  cqType: FacilityType;
  cqActive: boolean | undefined;
  cqOboOid: string | null;
  cwType: FacilityType;
  cwActive: boolean | undefined;
  cwOboOid: string | null;
};

export function dtoFromModel(facility: Facility): FacilityDTO {
  const { name, npi, tin, active, address } = facility.data;
  const { cqType, cqActive, cqOboOid, cwType, cwActive, cwOboOid } = facility;
  return {
    ...toBaseDTO(facility),
    id: facility.id,
    cqType,
    cqActive,
    cqOboOid,
    cwType,
    cwActive,
    cwOboOid,
    name,
    npi,
    tin,
    active,
    address,
  };
}
