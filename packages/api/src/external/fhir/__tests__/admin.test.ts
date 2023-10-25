/* eslint-disable @typescript-eslint/no-empty-function */
import { HapiFhirAdminClient } from "@metriport/core/external/fhir/api/api-hapi";
import { v4 as uuidv4 } from "uuid";
import { makeOrgNumber } from "../../../domain/medical/__tests__/organization";
import { createTenant, createTenantIfNotExists } from "../admin";

let apiMock_createTenant: jest.SpyInstance;
let apiMock_listTenants: jest.SpyInstance;
beforeEach(() => {
  jest.restoreAllMocks();
  apiMock_createTenant = jest
    .spyOn(HapiFhirAdminClient.prototype, "createTenant")
    .mockImplementation(async () => {});
  apiMock_listTenants = jest
    .spyOn(HapiFhirAdminClient.prototype, "listTenants")
    .mockImplementation(async () => []);
});

describe("fhir admin", () => {
  const organizationNumber = makeOrgNumber();
  const cxId = uuidv4();

  test("createTenant", async () => {
    await expect(createTenant({ organizationNumber, cxId })).resolves.not.toThrow();
    expect(apiMock_createTenant).toHaveBeenCalledWith({ organizationNumber, cxId });
  });

  test("createTenantSafe when tenant exists", async () => {
    apiMock_listTenants.mockResolvedValueOnce([uuidv4(), cxId, uuidv4()]);
    await expect(createTenantIfNotExists({ organizationNumber, cxId })).resolves.not.toThrow();
    expect(apiMock_listTenants).toHaveBeenCalledTimes(1);
    expect(apiMock_createTenant).not.toHaveBeenCalled();
  });

  test("createTenantSafe when tenant does not exists", async () => {
    apiMock_listTenants.mockResolvedValueOnce([uuidv4(), uuidv4()]);
    await expect(createTenantIfNotExists({ organizationNumber, cxId })).resolves.not.toThrow();
    expect(apiMock_listTenants).toHaveBeenCalledTimes(1);
    expect(apiMock_createTenant).toHaveBeenCalledWith({ organizationNumber, cxId });
  });
});
