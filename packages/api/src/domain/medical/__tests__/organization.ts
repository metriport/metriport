import { faker } from "@faker-js/faker";
import {
  Organization,
  OrganizationData,
  OrganizationBizType,
} from "@metriport/core/domain/organization";
import { makeBaseDomain } from "../../__tests__/base-domain";
import { makeAddressStrict } from "./location-address";
import { TreatmentType } from "@metriport/shared/domain/organization";

export function makeOrgNumber() {
  return faker.number.int({ min: 0, max: 1_000_000 });
}

export function makeOrganizationData(): OrganizationData {
  return {
    name: faker.string.uuid(),
    type: faker.helpers.arrayElement(Object.values(TreatmentType)),
    location: makeAddressStrict(),
  };
}
export function makeOrganization({
  id,
  oid,
  organizationNumber,
  type,
}: Partial<Organization> = {}): Organization {
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
    ehexActive: false,
    ehexApproved: false,
    principalOid: null,
    delegateOids: [],
  };
}
