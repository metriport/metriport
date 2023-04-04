import { Facility } from "../../../models/medical/facility";
import { AddressDTO } from "./addressDTO";
import { BaseDTO, toBaseDTO } from "./baseDTO";

export type FacilityDTO = BaseDTO & {
  id: string;
  name: string;
  npi: string;
  tin: string | undefined;
  active: boolean | undefined;
  address: AddressDTO;
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
