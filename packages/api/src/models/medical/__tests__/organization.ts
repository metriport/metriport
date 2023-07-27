import { faker } from "@faker-js/faker";
import { makeBaseDomain } from "../../../domain/__tests__/base-model";
import { Organization, OrganizationData, OrgType } from "../organization";
import { makeAddressStrict } from "./location-address";

export const makeOrgNumber = () => faker.number.int({ min: 0, max: 1_000_000_000 });

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
}: Partial<Organization> = {}): Organization => {
  return {
    ...makeBaseDomain({ id }),
    oid: oid ?? faker.string.uuid(),
    cxId: faker.string.uuid(),
    organizationNumber: organizationNumber != null ? organizationNumber : makeOrgNumber(),
    data: makeOrganizationData(),
  };
};
