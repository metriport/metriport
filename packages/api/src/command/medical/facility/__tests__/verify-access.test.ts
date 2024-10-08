/* eslint-disable @typescript-eslint/no-empty-function */
import { faker } from "@faker-js/faker";
import { NotFoundError } from "@metriport/shared";
import { OrganizationBizType } from "@metriport/core/domain/organization";
import { makeOrganization } from "../../../../domain/medical/__tests__/organization";
import * as getOrganizationOrFail from "../../organization/get-organization";
import { verifyCxItVendorAccess, verifyCxProviderAccess } from "../verify-access";

let getOrganizationOrFailMock: jest.SpyInstance;

beforeAll(() => {
  jest.restoreAllMocks();
  getOrganizationOrFailMock = jest.spyOn(getOrganizationOrFail, "getOrganizationOrFail");
});
beforeEach(() => {
  jest.clearAllMocks();
});

describe("verifyCxProviderAccess", () => {
  it("returns true when org is provider", async () => {
    const org = makeOrganization({ type: OrganizationBizType.healthcareProvider });
    getOrganizationOrFailMock.mockImplementation(async () => org);
    const res = await verifyCxProviderAccess(faker.string.uuid());
    expect(res).toBeTruthy();
  });

  it("returns false when org is it vendor and throwOnNoAccess is false", async () => {
    const org = makeOrganization({ type: OrganizationBizType.healthcareITVendor });
    getOrganizationOrFailMock.mockImplementation(async () => org);
    const res = await verifyCxProviderAccess(faker.string.uuid(), false);
    expect(res).toBeFalsy();
  });

  it("throws when org is it vendor and throwOnNoAccess is true", async () => {
    const org = makeOrganization({ type: OrganizationBizType.healthcareITVendor });
    getOrganizationOrFailMock.mockImplementation(async () => org);
    expect(async () => await verifyCxProviderAccess(faker.string.uuid(), true)).rejects.toThrow(
      "Facilities cannot be created or updated, contact support."
    );
  });

  it("throws when org is it vendor and throwOnNoAccess is not set", async () => {
    const org = makeOrganization({ type: OrganizationBizType.healthcareITVendor });
    getOrganizationOrFailMock.mockImplementation(async () => org);
    expect(async () => await verifyCxProviderAccess(faker.string.uuid())).rejects.toThrow(
      "Facilities cannot be created or updated, contact support."
    );
  });

  it("throws when org is not found", async () => {
    getOrganizationOrFailMock.mockImplementation(async () => {
      throw new NotFoundError("Organization not found");
    });
    expect(async () => await verifyCxProviderAccess(faker.string.uuid())).rejects.toThrow();
  });
});

describe("verifyCxItVendorAccess", () => {
  it("returns true when org is it vendor", async () => {
    const org = makeOrganization({ type: OrganizationBizType.healthcareITVendor });
    getOrganizationOrFailMock.mockImplementation(async () => org);
    const res = await verifyCxItVendorAccess(faker.string.uuid());
    expect(res).toBeTruthy();
  });

  it("returns false when org is provider and throwOnNoAccess is false", async () => {
    const org = makeOrganization({ type: OrganizationBizType.healthcareProvider });
    getOrganizationOrFailMock.mockImplementation(async () => org);
    const res = await verifyCxItVendorAccess(faker.string.uuid(), false);
    expect(res).toBeFalsy();
  });

  it("throws when org is provider and throwOnNoAccess is true", async () => {
    const org = makeOrganization({ type: OrganizationBizType.healthcareProvider });
    getOrganizationOrFailMock.mockImplementation(async () => org);
    expect(async () => await verifyCxItVendorAccess(faker.string.uuid(), true)).rejects.toThrow(
      "Facilities cannot be created or updated, contact support."
    );
  });

  it("throws when org is provider and throwOnNoAccess is not set", async () => {
    const org = makeOrganization({ type: OrganizationBizType.healthcareProvider });
    getOrganizationOrFailMock.mockImplementation(async () => org);
    expect(async () => await verifyCxItVendorAccess(faker.string.uuid())).rejects.toThrow(
      "Facilities cannot be created or updated, contact support."
    );
  });

  it("throws when org is not found", async () => {
    getOrganizationOrFailMock.mockImplementation(async () => {
      throw new NotFoundError("Organization not found");
    });
    expect(async () => await verifyCxItVendorAccess(faker.string.uuid())).rejects.toThrow();
  });
});
