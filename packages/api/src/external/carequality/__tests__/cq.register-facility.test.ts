/* eslint-disable @typescript-eslint/no-empty-function */
import { faker } from "@faker-js/faker";
import * as uuidv7_file from "@metriport/core/util/uuid-v7";
import { OrganizationBizType } from "@metriport/core/domain/organization";
import { metriportEmail as metriportEmailForCq } from "../constants";
import { metriportCompanyDetails } from "@metriport/shared";
import { Facility, FacilityType } from "../../../domain/medical/facility";
import { makeFacility } from "../../../domain/medical/__tests__/facility";
import * as getAddress from "../../../domain/medical/address";
import { addressWithCoordinates } from "./register-facility";
import {
  createOrUpdateFacilityInCq,
  metriportIntermediaryOid,
  metriportOid,
} from "../command/cq-directory/create-or-update-cq-facility";
import { getAddressWithCoordinates } from "../../../domain/medical/address";
import { buildCqOrgNameForFacility } from "../shared";
import * as createOrUpdateCqOrg from "../command/cq-directory/create-or-update-cq-organization";

let mockedFacility: Facility;
let mockedOboFacility: Facility;
let createOrUpdateCqOrganizationMock: jest.SpyInstance;

beforeEach(() => {
  mockedFacility = makeFacility({
    cqType: FacilityType.initiatorAndResponder,
    cqActive: false,
    cqOboOid: undefined,
    cwType: FacilityType.initiatorAndResponder,
    cwActive: true,
    cwOboOid: undefined,
  });

  mockedOboFacility = makeFacility({
    cqType: FacilityType.initiatorOnly,
    cqActive: false,
    cqOboOid: faker.string.uuid(),
    cwType: FacilityType.initiatorOnly,
    cwActive: true,
    cwOboOid: faker.string.uuid(),
  });

  jest.spyOn(getAddress, "getAddressWithCoordinates").mockResolvedValue(addressWithCoordinates);
  createOrUpdateCqOrganizationMock = jest.spyOn(
    createOrUpdateCqOrg,
    "createOrUpdateCQOrganization"
  );
  jest.spyOn(createOrUpdateCqOrg, "doesOrganizationExistInCQ").mockResolvedValue(false);
  jest.spyOn(createOrUpdateCqOrg, "registerOrganization").mockResolvedValue("test");
});

afterEach(() => {
  jest.restoreAllMocks();
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

    const { coordinates } = await getAddressWithCoordinates(mockedFacility.data.address, cxId);
    const address = mockedFacility.data.address;
    const addressLine = address.addressLine2
      ? `${address.addressLine1}, ${address.addressLine2}`
      : address.addressLine1;

    await createOrUpdateFacilityInCq({
      cxId,
      facility: {
        ...mockedFacility,
        ...addressWithCoordinates,
      },
      cxOrgName,
      cxOrgBizType,
      cqOboOid: mockedFacility.cqOboOid ?? undefined,
    });

    expect(createOrUpdateCqOrganizationMock).toHaveBeenCalledWith({
      name: orgName,
      addressLine1: addressLine,
      lat: coordinates.lat.toString(),
      lon: coordinates.lon.toString(),
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
    });
  });

  it("calls hie creates with expected params when createOrUpdateFacilityInCq is called - obo", async () => {
    const cxId = uuidv7_file.uuidv4();

    const cxOrgName = "Test";
    const cxOrgBizType = OrganizationBizType.healthcareITVendor;

    await createOrUpdateFacilityInCq({
      cxId,
      facility: mockedOboFacility,
      cxOrgName,
      cxOrgBizType,
      cqOboOid: mockedOboFacility.cqOboOid ?? undefined,
    });

    const orgName = buildCqOrgNameForFacility({
      vendorName: cxOrgName,
      orgName: mockedOboFacility.data.name,
      oboOid: mockedOboFacility.cqOboOid ?? undefined,
    });

    const { coordinates } = await getAddressWithCoordinates(mockedOboFacility.data.address, cxId);
    const address = mockedOboFacility.data.address;
    const addressLine = address.addressLine2
      ? `${address.addressLine1}, ${address.addressLine2}`
      : address.addressLine1;

    expect(createOrUpdateCqOrganizationMock).toHaveBeenCalledWith({
      name: orgName,
      addressLine1: addressLine,
      lat: coordinates.lat.toString(),
      lon: coordinates.lon.toString(),
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
    });
  });
});
