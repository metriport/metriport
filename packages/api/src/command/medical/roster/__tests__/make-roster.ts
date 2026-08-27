import { faker } from "@faker-js/faker";
import { Roster, rosterInitialStatus, RosterStatus } from "@metriport/shared";
import { RosterModel } from "../../../../models/medical/roster";

export type MakeRosterOverrides = Partial<Omit<Roster, "eTag" | "createdAt" | "updatedAt">>;

export function makeRoster(
  overrides: MakeRosterOverrides = {}
): Omit<Roster, "eTag" | "createdAt" | "updatedAt"> {
  return {
    id: faker.string.uuid(),
    cxId: faker.string.uuid(),
    source: faker.string.sample(),
    type: faker.string.sample(),
    status: rosterInitialStatus,
    data: {},
    ...overrides,
  };
}

export function makeRosterModel(overrides: MakeRosterOverrides = {}): RosterModel {
  const roster = makeRoster(overrides);
  return {
    ...roster,
    dataValues: roster,
    update: jest.fn().mockResolvedValue({ dataValues: roster }),
    destroy: jest.fn().mockResolvedValue(undefined),
    save: jest.fn().mockResolvedValue({ dataValues: roster }),
  } as unknown as RosterModel;
}

export function makeRosterCreateCmd(overrides: MakeRosterOverrides = {}): {
  cxId: string;
  source: string;
  type: string;
  status: RosterStatus;
  data?: unknown;
} {
  return {
    cxId: faker.string.uuid(),
    source: faker.string.sample(),
    type: faker.string.sample(),
    status: rosterInitialStatus,
    data: {},
    ...overrides,
  };
}
