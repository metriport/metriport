import { Organization, OrgType } from "../../../models/medical/organization";
import { AddressDTO } from "./addressDTO";
import { BaseDTO, toBaseDTO } from "./baseDTO";

export type OrganizationDTO = BaseDTO & {
  name: string;
  type: OrgType;
  location: AddressDTO;
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
