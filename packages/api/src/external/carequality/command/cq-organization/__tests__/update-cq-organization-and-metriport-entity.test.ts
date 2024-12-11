/* eslint-disable @typescript-eslint/no-empty-function */
import { faker } from "@faker-js/faker";
import { CarequalityManagementAPIImpl } from "@metriport/carequality-sdk/client/carequality";
import { metriportCompanyDetails } from "@metriport/shared";
import * as getAddress from "../../../../../domain/medical/address";
import { FacilityType } from "../../../../../domain/medical/facility";
import { makeFacilityModel } from "../../../../../domain/medical/__tests__/facility";
import { makeAddressWithCoordinates } from "../../../../../domain/medical/__tests__/location-address";
import { makeOrganizationModel } from "../../../../../domain/medical/__tests__/organization";
import { FacilityModel } from "../../../../../models/medical/facility";
import { OrganizationModel } from "../../../../../models/medical/organization";
import { metriportEmail as metriportEmailForCq } from "../../../constants";
import { CQDirectoryEntryData } from "../../../cq-directory";
import { buildCqOrgNameForFacility } from "../../../shared";
import * as createOrUpdateCqOrganizationFile from "../create-or-update-cq-organization";
import { metriportIntermediaryOid, metriportOid } from "../create-or-update-cq-organization";
import * as getCqOrgOrFailFile from "../get-cq-organization";
import { updateCqOrganizationAndMetriportEntity } from "../update-cq-organization-and-metriport-entity";

let getAddressWithCoordination: jest.SpyInstance;
let createOrUpdateCqOrganizationMock: jest.SpyInstance;
let getCqOrgOrFailMock: jest.SpyInstance;
let organizationMock: OrganizationModel;
let facilityMock: FacilityModel;
let oboFacilityMock: FacilityModel;

jest
  .spyOn(CarequalityManagementAPIImpl.prototype, "listOrganizations")
  .mockImplementation(() => Promise.resolve([]));
jest
  .spyOn(CarequalityManagementAPIImpl.prototype, "registerOrganization")
  .mockImplementation(() => Promise.resolve(""));

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
  getAddressWithCoordination = jest.spyOn(getAddress, "getAddressWithCoordinates");
  getCqOrgOrFailMock = jest.spyOn(getCqOrgOrFailFile, "getCqOrgOrFail");
  createOrUpdateCqOrganizationMock = jest
    .spyOn(createOrUpdateCqOrganizationFile, "createOrUpdateCqOrganization")
    .mockImplementation(() => Promise.resolve({} as CQDirectoryEntryData));
});

afterEach(() => {
  jest.clearAllMocks();
});

describe("updateCqOrganizationAndMetriportEntity", () => {
  it("calls hie creates with expected params when called - non-obo", async () => {
    const cxId = faker.string.uuid();
    const cxOrgName = faker.company.name();

    const orgName = buildCqOrgNameForFacility({
      vendorName: cxOrgName,
      orgName: facilityMock.data.name,
      oboOid: facilityMock.cqOboOid ?? undefined,
    });
    getCqOrgOrFailMock.mockResolvedValueOnce({ name: orgName } as CQDirectoryEntryData);

    const mockedAddress = makeAddressWithCoordinates();
    getAddressWithCoordination.mockImplementation(() => {
      return Promise.resolve(mockedAddress);
    });

    const address = facilityMock.data.address;
    const addressLine = address.addressLine2
      ? `${address.addressLine1}, ${address.addressLine2}`
      : address.addressLine1;

    await updateCqOrganizationAndMetriportEntity({
      cxId,
      facility: facilityMock,
      oid: facilityMock.oid,
      active: facilityMock.cqActive,
      org: organizationMock,
    });

    expect(createOrUpdateCqOrganizationMock).toHaveBeenCalledWith({
      name: orgName,
      addressLine1: addressLine,
      lat: mockedAddress.coordinates.lat.toString(),
      lon: mockedAddress.coordinates.lon.toString(),
      city: address.city,
      state: address.state,
      postalCode: address.zip,
      oid: facilityMock.oid,
      contactName: metriportCompanyDetails.name,
      phone: metriportCompanyDetails.phone,
      email: metriportEmailForCq,
      active: facilityMock.cqActive,
      parentOrgOid: metriportOid,
      role: "Connection" as const,
    });
  });

  it("calls hie creates with expected params when called - obo", async () => {
    const cxId = faker.string.uuid();
    const cxOrgName = faker.company.name();

    const orgName = buildCqOrgNameForFacility({
      vendorName: cxOrgName,
      orgName: oboFacilityMock.data.name,
      oboOid: oboFacilityMock.cqOboOid ?? undefined,
    });
    getCqOrgOrFailMock.mockResolvedValueOnce({ name: orgName } as CQDirectoryEntryData);

    const mockedAddress = makeAddressWithCoordinates();
    getAddressWithCoordination.mockImplementation(() => {
      return Promise.resolve(mockedAddress);
    });

    const address = oboFacilityMock.data.address;
    const addressLine = address.addressLine2
      ? `${address.addressLine1}, ${address.addressLine2}`
      : address.addressLine1;

    await updateCqOrganizationAndMetriportEntity({
      cxId,
      facility: oboFacilityMock,
      oid: oboFacilityMock.oid,
      active: oboFacilityMock.cqActive,
      org: organizationMock,
    });

    expect(createOrUpdateCqOrganizationMock).toHaveBeenCalledWith({
      name: orgName,
      addressLine1: addressLine,
      lat: mockedAddress.coordinates.lat.toString(),
      lon: mockedAddress.coordinates.lon.toString(),
      city: address.city,
      state: address.state,
      postalCode: address.zip,
      oid: oboFacilityMock.oid,
      contactName: metriportCompanyDetails.name,
      phone: metriportCompanyDetails.phone,
      email: metriportEmailForCq,
      active: oboFacilityMock.cqActive,
      parentOrgOid: metriportIntermediaryOid,
      role: "Connection" as const,
    });
  });
});
