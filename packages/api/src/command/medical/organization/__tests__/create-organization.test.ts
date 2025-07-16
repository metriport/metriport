/* eslint-disable @typescript-eslint/no-empty-function */
import { faker } from "@faker-js/faker";
import { v4 as uuidv4 } from "uuid";
import { makeOrganization } from "../../../../domain/medical/__tests__/organization";
import * as address from "../../../../domain/medical/address";
import * as cwCommands from "../../../../external/commonwell-v1";
import * as createTenant from "../../../../external/fhir/admin";
import * as upsertOrgToFHIRServer from "../../../../external/fhir/organization/upsert-organization";
import { OrganizationModel } from "../../../../models/medical/organization";
import { makeOrganizationOID } from "../../../../shared/oid";
import * as createId from "../../customer-sequence/create-id";
import { createOrganization } from "../create-organization";
import { addressWithCoordinates } from "./register-organization";

let createOrganizationId_mock: jest.SpyInstance;
let createTenantIfNotExistsMock: jest.SpyInstance;

beforeAll(() => {
  jest.restoreAllMocks();
  const organizationNumber = faker.number.int();
  createOrganizationId_mock = jest.spyOn(createId, "createOrganizationId").mockResolvedValue({
    oid: makeOrganizationOID(organizationNumber),
    organizationNumber,
  });
  createTenantIfNotExistsMock = jest
    .spyOn(createTenant, "createTenantIfNotExists")
    .mockImplementation(async () => {});
  jest.spyOn(upsertOrgToFHIRServer, "upsertOrgToFHIRServer").mockImplementation(async () => {});
  jest.spyOn(cwCommands.default.organization, "createOrUpdate").mockResolvedValue();
  jest.spyOn(address, "getAddressWithCoordinates").mockResolvedValue(addressWithCoordinates);
});
beforeEach(() => {
  jest.clearAllMocks();
});

describe("createOrganization", () => {
  const cxId = uuidv4();

  it("throws if org exists for customer", async () => {
    const org = makeOrganization();
    OrganizationModel.findOne = jest.fn().mockResolvedValueOnce(org);
    OrganizationModel.create = jest.fn().mockImplementation(() => Promise.resolve(org));

    await expect(
      createOrganization({
        ...org,
        cxId,
      })
    ).rejects.toThrow();
  });

  it("creates org with oid and number from createOrganizationId", async () => {
    OrganizationModel.findOne = jest.fn().mockResolvedValueOnce(undefined);
    const organizationNumber = faker.number.int();
    const oid = makeOrganizationOID(organizationNumber);
    createOrganizationId_mock.mockResolvedValueOnce({ oid, organizationNumber });
    const org = makeOrganization({ oid, organizationNumber });
    OrganizationModel.create = jest.fn().mockImplementation(() => Promise.resolve(org));

    await createOrganization({ ...org, cxId });

    expect(OrganizationModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ oid, organizationNumber, cxId, data: org.data })
    );
  });

  it("returns creates org", async () => {
    OrganizationModel.findOne = jest.fn().mockResolvedValueOnce(undefined);
    const organizationNumber = faker.number.int();
    const id = makeOrganizationOID(organizationNumber);
    createOrganizationId_mock.mockResolvedValueOnce({ id, organizationNumber });
    const org = makeOrganization({ id, organizationNumber });
    OrganizationModel.create = jest.fn().mockImplementation(() => Promise.resolve(org));

    const res = await createOrganization({ ...org, cxId });

    expect(res).toBeTruthy();
    expect(res).toEqual(expect.objectContaining(org));
  });

  it("calls createTenant", async () => {
    OrganizationModel.findOne = jest.fn().mockResolvedValueOnce(undefined);
    const org = makeOrganization();
    OrganizationModel.create = jest.fn().mockImplementation(() => Promise.resolve(org));

    await createOrganization({
      ...org,
      cxId,
    });

    expect(createTenantIfNotExistsMock).toHaveBeenCalledWith(org);
  });
});
