/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { faker } from "@faker-js/faker";
import { Organization } from "@medplum/fhirtypes";
import { CarequalityManagementAPI, CarequalityManagementApiFhir } from "@metriport/carequality-sdk";
import { OrganizationWithId } from "@metriport/carequality-sdk/client/carequality";
import { makeOrganization } from "@metriport/core/fhir-to-cda/cda-templates/components/__tests__/make-organization";
import { metriportCompanyDetails } from "@metriport/shared";
import * as getAddress from "../../../../../domain/medical/address";
import { FacilityType, isOboFacility } from "../../../../../domain/medical/facility";
import { makeFacilityModel } from "../../../../../domain/medical/__tests__/facility";
import { makeAddressWithCoordinates } from "../../../../../domain/medical/__tests__/location-address";
import { FacilityModel } from "../../../../../models/medical/facility";
import * as apiFhirFile from "../../../api";
import { metriportEmail as metriportEmailForCq } from "../../../constants";
import { buildCqOrgNameForFacility, buildCqOrgNameForOboFacility } from "../../../shared";
import { metriportIntermediaryOid, metriportOid } from "../constants";
import { createOrUpdateCqOrganization } from "../create-or-update-cq-organization";
import { getOrganizationFhirTemplate } from "../organization-template";

let getAddressWithCoordination: jest.SpyInstance;
let makeCarequalityManagementAPIMock: jest.SpyInstance<CarequalityManagementAPI | undefined>;
let facilityMock: FacilityModel;
let oboFacilityMock: FacilityModel;

jest
  .spyOn(CarequalityManagementApiFhir.prototype, "listOrganizations")
  .mockImplementation(() => Promise.resolve([]));
jest
  .spyOn(CarequalityManagementApiFhir.prototype, "registerOrganization")
  .mockImplementation(() => Promise.resolve({} as OrganizationWithId));

beforeEach(() => {
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
  makeCarequalityManagementAPIMock = jest.spyOn(apiFhirFile, "makeCarequalityManagementApiOrFail");
});

afterEach(() => {
  jest.clearAllMocks();
});

function makeApiImpl(params: {
  single?: Organization;
  list?: Organization[];
}): CarequalityManagementAPI {
  return {
    getOrganization: jest.fn().mockResolvedValue(params.single),
    listOrganizations: jest.fn().mockResolvedValue(params.list),
    updateOrganization: jest.fn().mockResolvedValue(params.single),
    registerOrganization: jest.fn().mockResolvedValue(params.single),
    deleteOrganization: jest.fn().mockResolvedValue(undefined),
  };
}

describe("createOrUpdateCqOrganization", () => {
  it("calls hie creates with expected params when called - non-obo", async () => {
    const cxId = faker.string.uuid();
    const cxOrgName = faker.company.name();

    const orgName = buildCqOrgNameForFacility({
      vendorName: cxOrgName,
      orgName: facilityMock.data.name,
    });
    const parentOrgOid = metriportOid;

    const mockedAddress = makeAddressWithCoordinates();
    getAddressWithCoordination.mockImplementation(() => {
      return Promise.resolve(mockedAddress);
    });

    const address = facilityMock.data.address;
    const addressLine = address.addressLine2
      ? `${address.addressLine1}, ${address.addressLine2}`
      : address.addressLine1;

    const expectedOrgDetails = {
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
      parentOrgOid,
      role: "Connection" as const,
    };
    const expectedCqOrg = await getOrganizationFhirTemplate(expectedOrgDetails);

    const apiImpl = makeApiImpl({
      single: makeOrganization({
        id: expectedCqOrg.id,
        identifier: [{ value: expectedCqOrg.id }],
        active: expectedCqOrg.active,
      }),
    });
    makeCarequalityManagementAPIMock.mockReturnValue(apiImpl);

    await createOrUpdateCqOrganization({
      cxId,
      oid: facilityMock.oid,
      name: orgName,
      address,
      contactName: metriportCompanyDetails.name,
      phone: metriportCompanyDetails.phone,
      email: metriportEmailForCq,
      active: facilityMock.cqActive,
      parentOrgOid,
      role: "Connection" as const,
    });

    expect(apiImpl.updateOrganization).toHaveBeenCalledWith(expect.objectContaining(expectedCqOrg));
  });

  it("calls hie creates with expected params when called - obo", async () => {
    const cxId = faker.string.uuid();
    const cxOrgName = faker.company.name();

    const isObo = isOboFacility(oboFacilityMock.cqType);
    const orgName = buildCqOrgNameForFacility({
      vendorName: cxOrgName,
      orgName: oboFacilityMock.data.name,
    });
    const oboName = buildCqOrgNameForOboFacility({
      vendorName: cxOrgName,
      orgName: oboFacilityMock.data.name,
      oboOid: oboFacilityMock.cqOboOid!,
    });
    const parentOrgOid = isObo ? metriportIntermediaryOid : metriportOid;

    const mockedAddress = makeAddressWithCoordinates();
    getAddressWithCoordination.mockImplementation(() => {
      return Promise.resolve(mockedAddress);
    });

    const address = oboFacilityMock.data.address;
    const addressLine = address.addressLine2
      ? `${address.addressLine1}, ${address.addressLine2}`
      : address.addressLine1;

    const expectedOrgDetails = {
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
      parentOrgOid,
      oboOid: oboFacilityMock.cqOboOid ?? undefined,
      oboName,
      role: "Connection" as const,
    };
    const expectedCqOrg = await getOrganizationFhirTemplate(expectedOrgDetails);

    const apiImpl = makeApiImpl({
      single: makeOrganization({
        id: expectedCqOrg.id,
        identifier: [{ value: expectedCqOrg.id }],
        active: expectedCqOrg.active,
      }),
    });
    makeCarequalityManagementAPIMock.mockReturnValue(apiImpl);

    await createOrUpdateCqOrganization({
      cxId,
      oid: oboFacilityMock.oid,
      name: orgName,
      address,
      contactName: metriportCompanyDetails.name,
      phone: metriportCompanyDetails.phone,
      email: metriportEmailForCq,
      active: oboFacilityMock.cqActive,
      parentOrgOid,
      oboOid: oboFacilityMock.cqOboOid ?? undefined,
      oboName,
      role: "Connection" as const,
    });

    expect(apiImpl.updateOrganization).toHaveBeenCalledWith(expect.objectContaining(expectedCqOrg));
  });
});
