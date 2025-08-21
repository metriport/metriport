import { fakerEN_US as faker } from "@faker-js/faker";
import { uniq } from "lodash";
import { CQOrgHydrated } from "../get-orgs";

export function makeSimpleOrg(
  p: Partial<CQOrgHydrated> & {
    mockStates?: string[];
    amountOfStates?: number;
  } = {}
): CQOrgHydrated {
  return {
    id: p.id ?? faker.string.uuid(),
    name: p.name ?? faker.lorem.word(),
    states:
      p.states ??
      uniq(
        new Array(p.amountOfStates ?? faker.number.int({ min: 1, max: 5 }))
          .fill(0)
          .map(() =>
            p.mockStates?.length ? faker.helpers.arrayElement(p.mockStates) : faker.location.state()
          )
      ),
    gateway: p.gateway ?? faker.lorem.word(),
    prio: p.prio,
  };
}
