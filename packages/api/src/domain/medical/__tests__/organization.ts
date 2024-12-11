import { faker } from "@faker-js/faker";
import {
  Organization,
  OrganizationBizType,
  OrganizationData,
  OrgType,
} from "@metriport/core/domain/organization";
import { OrganizationModel } from "../../../models/medical/organization";
import { makeBaseDomain } from "../../__tests__/base-domain";
import { makeAddressStrict } from "./location-address";

export const makeOrgNumber = () => faker.number.int({ min: 0, max: 1_000_000 });

export const makeOrganizationData = (): OrganizationData => {
  return {
    name: faker.string.uuid(),
    type: faker.helpers.arrayElement(Object.values(OrgType)),
    location: makeAddressStrict(),
  };
};
export const makeOrganization = ({
  id,
  oid,
  organizationNumber,
  type,
}: Partial<Organization> = {}): Organization => {
  return {
    ...makeBaseDomain({ id }),
    oid: oid ?? faker.string.uuid(),
    cxId: faker.string.uuid(),
    organizationNumber: organizationNumber != null ? organizationNumber : makeOrgNumber(),
    type: type ?? faker.helpers.arrayElement(Object.values(OrganizationBizType)),
    data: makeOrganizationData(),
    cqActive: false,
    cwActive: false,
    cqApproved: false,
    cwApproved: false,
  };
};

export function makeOrganizationModel(params?: Partial<OrganizationModel>): OrganizationModel {
  const organization = makeOrganization(params) as unknown as OrganizationModel;
  organization.dataValues = organization;
  organization.save = jest.fn();
  organization.update = jest.fn();
  organization.destroy = jest.fn();
  return organization;
}
