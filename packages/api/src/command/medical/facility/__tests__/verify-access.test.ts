/* eslint-disable @typescript-eslint/no-empty-function */
import { faker } from "@faker-js/faker";
import { OrganizationBizType } from "@metriport/core/domain/organization";
import NotFoundError from "@metriport/core/util/error/not-found";
import { makeOrganization } from "../../../../domain/medical/__tests__/organization";
import * as getOrganizationOrFail from "../../organization/get-organization";
import { verifyCxAccess } from "../verify-access";

let getOrganizationOrFailMock: jest.SpyInstance;

beforeAll(() => {
  jest.restoreAllMocks();
  getOrganizationOrFailMock = jest.spyOn(getOrganizationOrFail, "getOrganizationOrFail");
});
beforeEach(() => {
  jest.clearAllMocks();
});

describe("verifyCxAccess", () => {
  it("returns true when org is provider", async () => {
    const org = makeOrganization({ type: OrganizationBizType.healthcareProvider });
    getOrganizationOrFailMock.mockImplementation(async () => org);
    const res = await verifyCxAccess(faker.string.uuid());
    expect(res).toBeTruthy();
  });

  it("returns false when org is provider and throwOnNoAccess is false", async () => {
    const org = makeOrganization({ type: OrganizationBizType.healthcareITVendor });
    getOrganizationOrFailMock.mockImplementation(async () => org);
    const res = await verifyCxAccess(faker.string.uuid(), false);
    expect(res).toBeFalsy();
  });

  it("throws when org is provider and throwOnNoAccess is true", async () => {
    const org = makeOrganization({ type: OrganizationBizType.healthcareITVendor });
    getOrganizationOrFailMock.mockImplementation(async () => org);
    expect(async () => await verifyCxAccess(faker.string.uuid(), true)).rejects.toThrow(
      "Facilities cannot be created or updated, contact support."
    );
  });

  it("throws when org is provider and throwOnNoAccess is not set", async () => {
    const org = makeOrganization({ type: OrganizationBizType.healthcareITVendor });
    getOrganizationOrFailMock.mockImplementation(async () => org);
    expect(async () => await verifyCxAccess(faker.string.uuid())).rejects.toThrow(
      "Facilities cannot be created or updated, contact support."
    );
  });

  it("throws when org is not found", async () => {
    getOrganizationOrFailMock.mockImplementation(async () => {
      throw new NotFoundError("Organization not found");
    });
    expect(async () => await verifyCxAccess(faker.string.uuid())).rejects.toThrow();
  });
});
