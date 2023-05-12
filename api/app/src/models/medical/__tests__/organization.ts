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
export const makeOrganization = (): Organization => {
  return {
    ...makeBaseModel(),
    cxId: randUuid(),
    organizationNumber: randNumber(),
    data: makeOrganizationData(),
  };
};
