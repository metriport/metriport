import { Facility } from "../../../models/medical/facility";
import { BaseDTO, toBaseDTO } from "./baseDTO";

export type FacilityAddressDTO = {
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  zip: string;
  country?: string | null;
};

export type FacilityDTO = BaseDTO & {
  id: string;
  name: string;
  npi: string;
  tin: string | undefined;
  active: boolean | undefined;
  address: FacilityAddressDTO;
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
