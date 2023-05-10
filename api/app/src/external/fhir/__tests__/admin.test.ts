import { v4 as uuidv4 } from "uuid";
import { makeOrgNumber } from "../../../models/medical/__tests__/organization";
import { createTenant, createTenantSafe } from "../admin";
import { FHIRClient } from "../api";

let apiMock_createTenant: jest.SpyInstance;
let apiMock_listTenants: jest.SpyInstance;
beforeEach(() => {
  jest.restoreAllMocks();
  apiMock_createTenant = jest.spyOn(FHIRClient.prototype, "createTenant").mockImplementation();
  apiMock_listTenants = jest.spyOn(FHIRClient.prototype, "listTenants").mockImplementation();
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
    await expect(createTenantSafe({ organizationNumber, cxId })).resolves.not.toThrow();
    expect(apiMock_listTenants).toHaveBeenCalledTimes(1);
    expect(apiMock_createTenant).not.toHaveBeenCalled();
  });

  test("createTenantSafe when tenant does not exists", async () => {
    apiMock_listTenants.mockResolvedValueOnce([uuidv4(), uuidv4()]);
    await expect(createTenantSafe({ organizationNumber, cxId })).resolves.not.toThrow();
    expect(apiMock_listTenants).toHaveBeenCalledTimes(1);
    expect(apiMock_createTenant).toHaveBeenCalledWith({ organizationNumber, cxId });
  });
});
