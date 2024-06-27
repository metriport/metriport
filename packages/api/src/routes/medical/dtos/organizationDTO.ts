import { Organization, OrgType } from "@metriport/core/domain/organization";
import { BaseDTO, toBaseDTO } from "./baseDTO";
import { AddressStrictDTO } from "./location-address-dto";

export type OrganizationDTO = BaseDTO & {
  oid: string;
  name: string;
  type: OrgType;
  location: AddressStrictDTO;
};

export function dtoFromModel(org: Organization): OrganizationDTO {
  const { name, type, location } = org.data;
  return {
    ...toBaseDTO(org),
    oid: org.oid,
    name,
    type,
    location,
  };
}
