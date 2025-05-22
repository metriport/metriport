import { Organization, OrgType, OrganizationBizType } from "@metriport/core/domain/organization";
import { BaseDTO, toBaseDTO } from "./baseDTO";
import { AddressStrictDTO } from "./location-address-dto";

export type OrganizationDTO = BaseDTO & {
  oid: string;
  name: string;
  shortcode: string | undefined;
  type: OrgType;
  location: AddressStrictDTO;
};

export type InternalOrganizationDTO = BaseDTO &
  OrganizationDTO & {
    businessType: OrganizationBizType;
    cqApproved: boolean;
    cqActive: boolean;
    cwApproved: boolean;
    cwActive: boolean;
  };

export function dtoFromModel(org: Organization): OrganizationDTO {
  const { shortcode, name, type, location } = org.data;
  return {
    ...toBaseDTO(org),
    oid: org.oid,
    name,
    shortcode,
    type,
    location,
  };
}

export function internalDtoFromModel(org: Organization): InternalOrganizationDTO {
  const { shortcode, name, type, location } = org.data;

  return {
    ...toBaseDTO(org),
    oid: org.oid,
    businessType: org.type,
    name,
    shortcode,
    type,
    location,
    cqApproved: org.cqApproved,
    cqActive: org.cqActive,
    cwApproved: org.cwApproved,
    cwActive: org.cwActive,
  };
}
