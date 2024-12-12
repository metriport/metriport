/* eslint-disable @typescript-eslint/no-empty-function */
import { faker } from "@faker-js/faker";
import { OrganizationBizType } from "@metriport/core/domain/organization";
import NotFoundError from "@metriport/core/util/error/not-found";
import { makeOrganization } from "../../../../domain/medical/__tests__/organization";
import * as getOrganizationOrFail from "../../organization/get-organization";
import { verifyCxItVendorAccess, verifyCxProviderAccess } from "../verify-access";

let getOrganizationOrFailMock: jest.SpyInstance;

describe("verifyCxAccess", () => {
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

    it("throws when org is it vendor", async () => {
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

    it("throws when org is provider", async () => {
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
});
