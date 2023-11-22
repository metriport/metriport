/* eslint-disable @typescript-eslint/no-empty-function */
import { fakerEN_US as faker } from "@faker-js/faker";
import { CookieManagerInMemory } from "@metriport/core/domain/auth/cookie-management/cookie-manager-in-memory";
import * as orgs from "@metriport/core/external/commonwell/cq-bridge/get-orgs";
import { CQOrgHydrated } from "@metriport/core/external/commonwell/cq-bridge/get-orgs";
import { makeSimpleOrg } from "@metriport/core/external/commonwell/cq-bridge/__tests__/cq-orgs";
import { CommonWellManagementAPI } from "@metriport/core/external/commonwell/management/api";
import * as api from "../api";
import { initCQOrgIncludeList } from "../organization";
jest.mock("@metriport/core/external/commonwell/management/api");
jest.mock("@metriport/core/domain/auth/cookie-management/cookie-manager-in-memory");

let updateIncludeList_mock: jest.SpyInstance;
let getOrgsByPrio_mock: jest.SpyInstance;
let makeCommonWellManagementAPI_mock: jest.SpyInstance;
beforeEach(() => {
  jest.restoreAllMocks();
  updateIncludeList_mock = jest.spyOn(CommonWellManagementAPI.prototype, "updateIncludeList");
  getOrgsByPrio_mock = jest.spyOn(orgs, "getOrgsByPrio");
  makeCommonWellManagementAPI_mock = jest
    .spyOn(api, "makeCommonWellManagementAPI")
    .mockImplementation(() => {
      return new CommonWellManagementAPI({
        cookieManager: new CookieManagerInMemory(),
        baseUrl: "",
      });
    });
});

describe("organization", () => {
  describe("initCQOrgIncludeList", () => {
    it("dont update if no managementApi", async () => {
      const orgOID = faker.string.uuid();
      makeCommonWellManagementAPI_mock.mockImplementationOnce(() => undefined);

      await initCQOrgIncludeList(orgOID);

      expect(updateIncludeList_mock).not.toHaveBeenCalled();
    });

    it("updates if when managementApi is present", async () => {
      const orgOID = faker.string.uuid();

      await initCQOrgIncludeList(orgOID);

      expect(updateIncludeList_mock).toHaveBeenCalledWith(
        expect.objectContaining({
          oid: orgOID,
        })
      );
    });

    it("links to the high prio orgs", async () => {
      const orgOID = faker.string.uuid();
      const orgs: CQOrgHydrated[] = [makeSimpleOrg(), makeSimpleOrg()];
      const expectedCQOrgIds = orgs.map(o => o.id);
      getOrgsByPrio_mock.mockReturnValueOnce({ high: orgs });

      await initCQOrgIncludeList(orgOID);

      expect(updateIncludeList_mock).toHaveBeenCalledWith(
        expect.objectContaining({
          careQualityOrgIds: expectedCQOrgIds,
        })
      );
    });

    it("limits to 50 orgs", async () => {
      const orgs: CQOrgHydrated[] = new Array(100).fill(0).map(makeSimpleOrg);
      expect(orgs.length).toEqual(100);
      getOrgsByPrio_mock.mockReturnValueOnce({ high: orgs });

      await initCQOrgIncludeList(faker.string.uuid());

      const param = updateIncludeList_mock.mock.calls[0][0];
      expect(param).toBeTruthy();
      const careQualityOrgIds = param.careQualityOrgIds;
      expect(careQualityOrgIds).toBeTruthy();
      expect(careQualityOrgIds.length).toEqual(50);
    });

    it("dont throw on error", async () => {
      updateIncludeList_mock.mockImplementationOnce(() => {
        throw new Error("test error");
      });
      await expect(initCQOrgIncludeList(faker.string.uuid())).resolves.not.toThrow();
    });
  });
});
