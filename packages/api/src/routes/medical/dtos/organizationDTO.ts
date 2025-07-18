import { Organization } from "@metriport/core/domain/organization";
import { OrganizationBizType, TreatmentType } from "@metriport/shared";
import { BaseDTO, toBaseDTO } from "./baseDTO";
import { AddressStrictDTO } from "./location-address-dto";

export type OrganizationDTO = BaseDTO & {
  oid: string;
  name: string;
  shortcode: string | undefined;
  type: TreatmentType;
  location: AddressStrictDTO;
};

export type InternalOrganizationDTO = BaseDTO &
  OrganizationDTO & {
    cxId: string;
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
  return {
    ...dtoFromModel(org),
    cxId: org.cxId,
    businessType: org.type,
    cqApproved: org.cqApproved,
    cqActive: org.cqActive,
    cwApproved: org.cwApproved,
    cwActive: org.cwActive,
  };
}
