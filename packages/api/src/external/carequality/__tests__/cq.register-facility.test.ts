/* eslint-disable @typescript-eslint/no-empty-function */
import { faker } from "@faker-js/faker";
import * as uuidv7_file from "@metriport/core/util/uuid-v7";
import { OrganizationBizType } from "@metriport/core/domain/organization";
import { CarequalityManagementAPIImpl } from "@metriport/carequality-sdk/client/carequality";
import { metriportEmail as metriportEmailForCq } from "../constants";
import { metriportCompanyDetails } from "@metriport/shared";
import { FacilityType } from "../../../domain/medical/facility";
import { makeFacility } from "../../../domain/medical/__tests__/facility";
import * as getAddress from "../../../domain/medical/address";
import {
  createOrUpdateFacilityInCq,
  metriportIntermediaryOid,
  metriportOid,
} from "../command/cq-directory/create-or-update-cq-facility";
import { makeAddressWithCoordinates } from "../../../domain/medical/__tests__/location-address";
import { buildCqOrgNameForFacility } from "../shared";
import * as createOrUpdateCqOrg from "../command/cq-directory/create-or-update-cq-organization";

let getAddressWithCoordination: jest.SpyInstance;
let createOrUpdateCqOrganizationMock: jest.SpyInstance;

const mockedFacility = makeFacility({
  cqType: FacilityType.initiatorAndResponder,
  cqActive: true,
  cqOboOid: undefined,
  cwType: FacilityType.initiatorAndResponder,
  cwActive: true,
  cwOboOid: undefined,
});

const mockedOboFacility = makeFacility({
  cqType: FacilityType.initiatorOnly,
  cqActive: true,
  cqOboOid: faker.string.uuid(),
  cwType: FacilityType.initiatorOnly,
  cwActive: true,
  cwOboOid: faker.string.uuid(),
});

jest
  .spyOn(CarequalityManagementAPIImpl.prototype, "listOrganizations")
  .mockImplementation(() => Promise.resolve([]));
jest
  .spyOn(CarequalityManagementAPIImpl.prototype, "registerOrganization")
  .mockImplementation(() => Promise.resolve(""));

beforeEach(() => {
  getAddressWithCoordination = jest.spyOn(getAddress, "getAddressWithCoordinates");
  createOrUpdateCqOrganizationMock = jest.spyOn(
    createOrUpdateCqOrg,
    "createOrUpdateCQOrganization"
  );
});

afterEach(() => {
  jest.clearAllMocks();
});

describe("registerFacility", () => {
  it("calls hie creates with expected params when createOrUpdateFacilityInCq is called - non-obo", async () => {
    const cxId = uuidv7_file.uuidv4();

    const cxOrgName = "Test";
    const cxOrgBizType = OrganizationBizType.healthcareITVendor;

    const orgName = buildCqOrgNameForFacility({
      vendorName: cxOrgName,
      orgName: mockedFacility.data.name,
      oboOid: mockedFacility.cqOboOid ?? undefined,
    });

    const mockedAddress = makeAddressWithCoordinates();
    getAddressWithCoordination.mockImplementation(() => {
      return Promise.resolve(mockedAddress);
    });

    const address = mockedFacility.data.address;
    const addressLine = address.addressLine2
      ? `${address.addressLine1}, ${address.addressLine2}`
      : address.addressLine1;

    await createOrUpdateFacilityInCq({
      cxId,
      facility: mockedFacility,
      facilityCurrentActive: mockedFacility.cqActive,
      cxOrgName,
      cxOrgBizType,
      cqOboOid: mockedFacility.cqOboOid ?? undefined,
    });

    expect(createOrUpdateCqOrganizationMock).toHaveBeenCalledWith(
      {
        name: orgName,
        addressLine1: addressLine,
        lat: mockedAddress.coordinates.lat.toString(),
        lon: mockedAddress.coordinates.lon.toString(),
        city: address.city,
        state: address.state,
        postalCode: address.zip,
        oid: mockedFacility.oid,
        contactName: metriportCompanyDetails.name,
        phone: metriportCompanyDetails.phone,
        email: metriportEmailForCq,
        organizationBizType: cxOrgBizType,
        active: mockedFacility.cqActive,
        parentOrgOid: metriportOid,
        role: "Connection" as const,
      },
      mockedFacility.cqActive
    );
  });

  it("calls hie creates with expected params when createOrUpdateFacilityInCq is called - obo", async () => {
    const cxId = uuidv7_file.uuidv4();

    const cxOrgName = "Test";
    const cxOrgBizType = OrganizationBizType.healthcareITVendor;

    const orgName = buildCqOrgNameForFacility({
      vendorName: cxOrgName,
      orgName: mockedOboFacility.data.name,
      oboOid: mockedOboFacility.cqOboOid ?? undefined,
    });

    const mockedAddress = makeAddressWithCoordinates();
    getAddressWithCoordination.mockImplementation(() => {
      return Promise.resolve(mockedAddress);
    });

    const address = mockedOboFacility.data.address;
    const addressLine = address.addressLine2
      ? `${address.addressLine1}, ${address.addressLine2}`
      : address.addressLine1;

    await createOrUpdateFacilityInCq({
      cxId,
      facility: mockedOboFacility,
      facilityCurrentActive: mockedOboFacility.cqActive,
      cxOrgName,
      cxOrgBizType,
      cqOboOid: mockedOboFacility.cqOboOid ?? undefined,
    });

    expect(createOrUpdateCqOrganizationMock).toHaveBeenCalledWith(
      {
        name: orgName,
        addressLine1: addressLine,
        lat: mockedAddress.coordinates.lat.toString(),
        lon: mockedAddress.coordinates.lon.toString(),
        city: address.city,
        state: address.state,
        postalCode: address.zip,
        oid: mockedOboFacility.oid,
        contactName: metriportCompanyDetails.name,
        phone: metriportCompanyDetails.phone,
        email: metriportEmailForCq,
        organizationBizType: cxOrgBizType,
        active: mockedOboFacility.cqActive,
        parentOrgOid: metriportIntermediaryOid,
        role: "Connection" as const,
      },
      mockedFacility.cqActive
    );
  });
});
