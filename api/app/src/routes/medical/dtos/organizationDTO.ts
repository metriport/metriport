import { Organization, OrgType } from "../../../models/medical/organization";
import { AddressDTO } from "./addressDTO";

export type OrganizationDTO = {
  id: string;
  name: string;
  type: OrgType;
  location: AddressDTO;
};

export function dtoFromModel(org: Organization): OrganizationDTO {
  const { name, type, location } = org.data;
  return {
    id: org.id,
    name,
    type,
    location,
  };
}
