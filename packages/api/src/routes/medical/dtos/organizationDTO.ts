import { Organization, OrgType, OrganizationBizType } from "@metriport/core/domain/organization";
import { BaseDTO, toBaseDTO } from "./baseDTO";
import { AddressStrictDTO } from "./location-address-dto";

export type OrganizationDTO = BaseDTO & {
  oid: string;
  name: string;
  type: OrgType;
  location: AddressStrictDTO;
};

export type InternalOrganizationDTO = BaseDTO &
  OrganizationDTO & {
    businessType: OrganizationBizType;
    cqActive: boolean;
    cwActive: boolean;
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

export function internalDtoFromModel(org: Organization): InternalOrganizationDTO {
  const { name, type, location } = org.data;
  return {
    ...toBaseDTO(org),
    oid: org.oid,
    businessType: org.type,
    name,
    type,
    location,
    cqActive: org.cqActive,
    cwActive: org.cwActive,
  };
}
