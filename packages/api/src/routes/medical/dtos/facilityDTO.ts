import { Facility } from "../../../domain/medical/facility";
import { BaseDTO, toBaseDTO } from "./baseDTO";
import { AddressStrictDTO } from "./location-address-dto";

export type FacilityDTO = BaseDTO & {
  id: string;
  name: string;
  npi: string;
  tin: string | undefined;
  active: boolean | undefined;
  address: AddressStrictDTO;
};

export function dtoFromModel(facility: Facility): FacilityDTO {
  const { name, npi, tin, active, address } = facility.data;
  return {
    ...toBaseDTO(facility),
    id: facility.id,
    name,
    npi,
    tin,
    active,
    address,
  };
}
