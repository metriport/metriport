import { rand, randNumber, randUuid } from "@ngneat/falso";
import { makeBaseModel } from "../../__tests__/base-model";
import { Organization, OrganizationData, OrgType } from "../organization";
import { makeAddressStrict } from "./location-address";

export const makeOrgNumber = () => randNumber({ min: 0, max: 1_000_000_000 });

export const makeOrganizationData = (): OrganizationData => {
  return {
    name: randUuid(),
    type: rand(Object.values(OrgType)),
    location: makeAddressStrict(),
  };
};
export const makeOrganization = ({
  id,
  organizationNumber,
}: Partial<Organization> = {}): Organization => {
  return {
    ...makeBaseModel({ id }),
    cxId: randUuid(),
    organizationNumber: organizationNumber != null ? organizationNumber : randNumber(),
    data: makeOrganizationData(),
  };
};
