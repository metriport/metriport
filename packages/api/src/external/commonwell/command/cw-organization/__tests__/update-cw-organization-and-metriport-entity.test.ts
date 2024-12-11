/* eslint-disable @typescript-eslint/no-empty-function */
import { faker } from "@faker-js/faker";
import { FacilityType } from "../../../../../domain/medical/facility";
import { makeFacilityModel } from "../../../../../domain/medical/__tests__/facility";
import { makeOrganizationModel } from "../../../../../domain/medical/__tests__/organization";
import { FacilityModel } from "../../../../../models/medical/facility";
import { OrganizationModel } from "../../../../../models/medical/organization";
import { buildCwOrgNameForFacility, CwOrgDetails } from "../../../shared";
import * as createOrUpdateCwOrganizationFile from "../create-or-update-cw-organization";
import * as getOrgOrFailFile from "../get-cw-organization";
import { updateCwOrganizationAndMetriportEntity } from "../update-cw-organization-and-metriport-entity";

let createOrUpdateCwOrganizationMock: jest.SpyInstance;
let organizationMock: OrganizationModel;
let facilityMock: FacilityModel;
let oboFacilityMock: FacilityModel;
let getOrgOrFailMock: jest.SpyInstance;

beforeAll(() => {
  jest.restoreAllMocks();
});
afterAll(() => {
  jest.restoreAllMocks();
});

beforeEach(() => {
  organizationMock = makeOrganizationModel();
  facilityMock = makeFacilityModel({
    cqType: FacilityType.initiatorAndResponder,
    cqActive: true,
    cqOboOid: undefined,
    cwType: FacilityType.initiatorAndResponder,
    cwActive: true,
    cwOboOid: undefined,
  });
  oboFacilityMock = makeFacilityModel({
    cqType: FacilityType.initiatorOnly,
    cqActive: true,
    cqOboOid: faker.string.uuid(),
    cwType: FacilityType.initiatorOnly,
    cwActive: true,
    cwOboOid: faker.string.uuid(),
  });
  createOrUpdateCwOrganizationMock = jest
    .spyOn(createOrUpdateCwOrganizationFile, "createOrUpdateCwOrganization")
    .mockImplementation(() => Promise.resolve({} as CwOrgDetails));
  getOrgOrFailMock = jest.spyOn(getOrgOrFailFile, "getOrgOrFail");
});

afterEach(() => {
  jest.clearAllMocks();
});

describe("updateCwOrganizationAndMetriportEntity", () => {
  it("calls hie creates with expected params when called - non-obo", async () => {
    const cxId = faker.string.uuid();
    const cxOrgName = faker.company.name();

    const orgName = buildCwOrgNameForFacility({
      vendorName: cxOrgName,
      orgName: facilityMock.data.name,
      oboOid: facilityMock.cwOboOid ?? undefined,
    });
    getOrgOrFailMock.mockResolvedValueOnce({ name: orgName } as CwOrgDetails);

    await updateCwOrganizationAndMetriportEntity({
      cxId,
      oid: facilityMock.oid,
      active: facilityMock.cwActive,
      org: organizationMock,
      facility: facilityMock,
    });

    expect(createOrUpdateCwOrganizationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        cxId,
        orgDetails: {
          oid: facilityMock.oid,
          name: orgName,
          data: {
            name: orgName,
            type: organizationMock.data.type,
            location: facilityMock.data.address,
          },
          active: facilityMock.cwActive,
          isObo: false,
        },
      })
    );
  });

  it("calls hie creates with expected params when called - obo", async () => {
    const cxId = faker.string.uuid();
    const cxOrgName = faker.company.name();

    const orgName = buildCwOrgNameForFacility({
      vendorName: cxOrgName,
      orgName: oboFacilityMock.data.name,
      oboOid: oboFacilityMock.cwOboOid ?? undefined,
    });
    getOrgOrFailMock.mockResolvedValueOnce({ name: orgName } as CwOrgDetails);

    await updateCwOrganizationAndMetriportEntity({
      cxId,
      oid: oboFacilityMock.oid,
      active: oboFacilityMock.cwActive,
      org: organizationMock,
      facility: oboFacilityMock,
    });

    expect(createOrUpdateCwOrganizationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        cxId,
        orgDetails: {
          oid: oboFacilityMock.oid,
          name: orgName,
          data: {
            name: orgName,
            type: organizationMock.data.type,
            location: oboFacilityMock.data.address,
          },
          active: oboFacilityMock.cwActive,
          isObo: true,
        },
      })
    );
  });
});
