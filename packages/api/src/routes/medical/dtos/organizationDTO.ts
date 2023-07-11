import { Organization, OrgType } from "../../../models/medical/organization";
import { BaseDTO, toBaseDTO } from "./baseDTO";
import { AddressStrictDTO } from "./location-address-dto";

export type OrganizationDTO = BaseDTO & {
  name: string;
  type: OrgType;
  location: AddressStrictDTO;
};

export function dtoFromModel(org: Organization): OrganizationDTO {
  const { name, type, location } = org.data;
  return {
    ...toBaseDTO(org),
    name,
    type,
    location,
  };
}
