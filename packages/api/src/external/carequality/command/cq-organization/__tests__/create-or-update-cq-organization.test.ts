/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { faker } from "@faker-js/faker";
import { Organization } from "@medplum/fhirtypes";
import { CarequalityManagementAPI, CarequalityManagementApiFhir } from "@metriport/carequality-sdk";
import { OrganizationWithId } from "@metriport/carequality-sdk/client/carequality";
import { makeOrganization } from "@metriport/core/fhir-to-cda/cda-templates/components/__tests__/make-organization";
import { FacilityType } from "@metriport/core/domain/facility";
import { metriportCompanyDetails } from "@metriport/shared";
import { makeFacilityModel } from "../../../../../domain/medical/__tests__/facility";
import { makeAddressWithCoordinates } from "../../../../../domain/medical/__tests__/location-address";
import * as getAddress from "../../../../../domain/medical/address";
import { isInitiatorOnly } from "../../../../../domain/medical/facility";
import { FacilityModel } from "../../../../../models/medical/facility";
import * as apiFhirFile from "../../../api";
import { metriportEmail as metriportEmailForCq } from "../../../constants";
import { buildCqOrgNameForFacility } from "../../../shared";
import { metriportIntermediaryOid, metriportOid } from "../constants";
import { createOrUpdateCqOrganization } from "../create-or-update-cq-organization";
import { getOrganizationFhirTemplate } from "../organization-template";

let getAddressWithCoordination: jest.SpyInstance;
let makeCarequalityManagementAPIMock: jest.SpyInstance<CarequalityManagementAPI | undefined>;
let facilityMock: FacilityModel;
let delegateFacilityMock: FacilityModel;

jest
  .spyOn(CarequalityManagementApiFhir.prototype, "listOrganizations")
  .mockImplementation(() => Promise.resolve([]));
jest
  .spyOn(CarequalityManagementApiFhir.prototype, "registerOrganization")
  .mockImplementation(() => Promise.resolve({} as OrganizationWithId));

beforeEach(() => {
  facilityMock = makeFacilityModel({
    type: FacilityType.initiatorAndResponder,
    cqActive: true,
    cwActive: true,
    principalOid: undefined,
  });
  delegateFacilityMock = makeFacilityModel({
    type: FacilityType.initiatorOnly,
    cqActive: true,
    cwActive: true,
    principalOid: faker.string.uuid(),
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
  it("calls hie creates with expected params when called - principal org", async () => {
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

  it("calls hie creates with expected params when called - delegate", async () => {
    const cxId = faker.string.uuid();
    const cxOrgName = faker.company.name();

    const isInitiator = isInitiatorOnly(delegateFacilityMock.type);
    const orgName = buildCqOrgNameForFacility({
      vendorName: cxOrgName,
      orgName: delegateFacilityMock.data.name,
    });
    const parentOrgOid = isInitiator ? metriportIntermediaryOid : metriportOid;

    const mockedAddress = makeAddressWithCoordinates();
    getAddressWithCoordination.mockImplementation(() => {
      return Promise.resolve(mockedAddress);
    });

    const address = delegateFacilityMock.data.address;
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
      oid: delegateFacilityMock.oid,
      contactName: metriportCompanyDetails.name,
      phone: metriportCompanyDetails.phone,
      email: metriportEmailForCq,
      active: delegateFacilityMock.cqActive,
      parentOrgOid,
      principalOid: delegateFacilityMock.principalOid ?? undefined,
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
      oid: delegateFacilityMock.oid,
      name: orgName,
      address,
      contactName: metriportCompanyDetails.name,
      phone: metriportCompanyDetails.phone,
      email: metriportEmailForCq,
      active: delegateFacilityMock.cqActive,
      parentOrgOid,
      principalOid: delegateFacilityMock.principalOid ?? undefined,
      role: "Connection" as const,
    });

    expect(apiImpl.updateOrganization).toHaveBeenCalledWith(expect.objectContaining(expectedCqOrg));
  });
});
