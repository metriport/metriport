/* eslint-disable @typescript-eslint/no-empty-function */
import { faker } from "@faker-js/faker";
import { OrganizationBizType } from "@metriport/core/domain/organization";
import { NotFoundError } from "@metriport/shared";
import { makeOrganization } from "../../../../domain/medical/__tests__/organization";
import * as getOrganizationOrFail from "../../organization/get-organization";
import {
  verifyCxAccessToSendFacilityToHies,
  verifyCxAccessToSendOrgToHies,
} from "../verify-access";

let getOrganizationOrFailMock: jest.SpyInstance;

describe("verifyCxAccess", () => {
  beforeAll(() => {
    jest.restoreAllMocks();
    getOrganizationOrFailMock = jest.spyOn(getOrganizationOrFail, "getOrganizationOrFail");
  });
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("verifyCxAccessToSendOrgToHies", () => {
    it("returns true when org is provider", async () => {
      const org = makeOrganization({ type: OrganizationBizType.healthcareProvider });
      getOrganizationOrFailMock.mockImplementation(async () => org);
      const res = await verifyCxAccessToSendOrgToHies(faker.string.uuid());
      expect(res).toBeTruthy();
    });

    it("throws when org is IT vendor", async () => {
      const org = makeOrganization({ type: OrganizationBizType.healthcareITVendor });
      getOrganizationOrFailMock.mockImplementation(async () => org);
      expect(async () => await verifyCxAccessToSendOrgToHies(faker.string.uuid())).rejects.toThrow(
        "Only Providers can send organizations to HIEs"
      );
    });

    it("throws when org is not found", async () => {
      getOrganizationOrFailMock.mockImplementation(async () => {
        throw new NotFoundError("Organization not found");
      });
      expect(
        async () => await verifyCxAccessToSendOrgToHies(faker.string.uuid())
      ).rejects.toThrow();
    });
  });

  describe("verifyCxAccessToSendFacilityToHies", () => {
    it("returns true when org is IT vendor", async () => {
      const org = makeOrganization({ type: OrganizationBizType.healthcareITVendor });
      getOrganizationOrFailMock.mockImplementation(async () => org);
      const res = await verifyCxAccessToSendFacilityToHies(faker.string.uuid());
      expect(res).toBeTruthy();
    });

    it("throws when org is provider", async () => {
      const org = makeOrganization({ type: OrganizationBizType.healthcareProvider });
      getOrganizationOrFailMock.mockImplementation(async () => org);
      expect(
        async () => await verifyCxAccessToSendFacilityToHies(faker.string.uuid())
      ).rejects.toThrow("Only IT Vendors can send facilities to HIEs");
    });

    it("throws when org is not found", async () => {
      getOrganizationOrFailMock.mockImplementation(async () => {
        throw new NotFoundError("Organization not found");
      });
      expect(
        async () => await verifyCxAccessToSendFacilityToHies(faker.string.uuid())
      ).rejects.toThrow();
    });
  });
});
