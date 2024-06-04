/* eslint-disable @typescript-eslint/no-empty-function */
import { faker } from "@faker-js/faker";
import { v4 as uuidv4 } from "uuid";
import {
  makeOrganization,
  makeOrganizationData,
} from "../../../../domain/medical/__tests__/organization";
import * as createTenant from "../../../../external/fhir/admin";
import { OrganizationModel } from "../../../../models/medical/organization";
import { makeOrganizationOID } from "../../../../shared/oid";
import * as createId from "../../customer-sequence/create-id";
import { createOrganization } from "../create-organization";
import * as upsertOrgToFHIRServer from "../../../../external/fhir/organization/upsert-organization";
import * as cwCommands from "../../../../external/commonwell";

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
  jest.spyOn(cwCommands.default.organization, "create").mockImplementation(async () => {});
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
    const orgCreate = makeOrganizationData();

    await expect(
      createOrganization({
        ...orgCreate,
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
    const orgCreate = makeOrganizationData();

    await createOrganization({ ...orgCreate, cxId });

    expect(OrganizationModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ oid, organizationNumber, cxId, data: orgCreate })
    );
  });

  it("returns creates org", async () => {
    OrganizationModel.findOne = jest.fn().mockResolvedValueOnce(undefined);
    const organizationNumber = faker.number.int();
    const id = makeOrganizationOID(organizationNumber);
    createOrganizationId_mock.mockResolvedValueOnce({ id, organizationNumber });
    const org = makeOrganization({ id, organizationNumber });
    OrganizationModel.create = jest.fn().mockImplementation(() => Promise.resolve(org));
    const orgCreate = makeOrganizationData();

    const res = await createOrganization({ ...orgCreate, cxId });

    expect(res).toBeTruthy();
    expect(res).toEqual(expect.objectContaining(org));
  });

  it("calls createTenant", async () => {
    OrganizationModel.findOne = jest.fn().mockResolvedValueOnce(undefined);
    const expectedOrg = makeOrganization();
    OrganizationModel.create = jest.fn().mockImplementation(() => Promise.resolve(expectedOrg));
    const orgCreate = makeOrganizationData();

    await createOrganization({
      ...orgCreate,
      cxId,
    });

    expect(createTenantIfNotExistsMock).toHaveBeenCalledWith(expectedOrg);
  });
});
