/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { faker } from "@faker-js/faker";
import { Organization } from "@medplum/fhirtypes";
import {
  CarequalityManagementAPIFhir,
  CarequalityManagementAPIImplFhir,
} from "@metriport/carequality-sdk";
import { makeOrganization } from "@metriport/core/fhir-to-cda/cda-templates/components/__tests__/make-organization";
import { metriportCompanyDetails } from "@metriport/shared";
import { makeFacilityModel } from "../../../../../domain/medical/__tests__/facility";
import { makeAddressWithCoordinates } from "../../../../../domain/medical/__tests__/location-address";
import * as getAddress from "../../../../../domain/medical/address";
import { FacilityType, isOboFacility } from "../../../../../domain/medical/facility";
import { FacilityModel } from "../../../../../models/medical/facility";
import * as apiFhirFile from "../../../api";
import { metriportEmail as metriportEmailForCq } from "../../../constants";
import { CQDirectoryEntryData } from "../../../cq-directory";
import { buildCqOrgNameForFacility, buildCqOrgNameForOboFacility } from "../../../shared";
import { metriportIntermediaryOid, metriportOid } from "../constants";
import { createOrUpdateCqOrganization } from "../create-or-update-cq-organization";
import * as getCqOrgFile from "../get-cq-organization";
import { getOrganizationFhirTemplate } from "../organization-template";

let getAddressWithCoordination: jest.SpyInstance;
let makeCarequalityManagementAPIFhirMock: jest.SpyInstance<CarequalityManagementAPIFhir>;
let getCqOrgMock: jest.SpyInstance;
let facilityMock: FacilityModel;
let oboFacilityMock: FacilityModel;

jest
  .spyOn(CarequalityManagementAPIImplFhir.prototype, "listOrganizations")
  .mockImplementation(() => Promise.resolve([]));
jest
  .spyOn(CarequalityManagementAPIImplFhir.prototype, "registerOrganization")
  .mockImplementation(() => Promise.resolve({} as Organization));

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
  getCqOrgMock = jest.spyOn(getCqOrgFile, "getCqOrg");
  makeCarequalityManagementAPIFhirMock = jest.spyOn(
    apiFhirFile,
    "makeCarequalityManagementAPIFhir"
  );
});

afterEach(() => {
  jest.clearAllMocks();
});

function makeApiImpl(params: {
  single?: Organization;
  list?: Organization[];
}): CarequalityManagementAPIFhir {
  return {
    getOrganization: jest.fn().mockResolvedValue(params.single),
    listOrganizations: jest.fn().mockResolvedValue(params.list),
    updateOrganization: jest.fn().mockResolvedValue(params.single),
    registerOrganization: jest.fn().mockResolvedValue(params.single),
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
    getCqOrgMock.mockResolvedValueOnce({ name: orgName } as CQDirectoryEntryData);

    const mockedAddress = makeAddressWithCoordinates();
    getAddressWithCoordination.mockImplementation(() => {
      return Promise.resolve(mockedAddress);
    });

    const address = facilityMock.data.address;
    const addressLine = address.addressLine2
      ? `${address.addressLine1}, ${address.addressLine2}`
      : address.addressLine1;

    const epectedOrgDetails = {
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
    const expectedCqOrg = getOrganizationFhirTemplate(epectedOrgDetails);

    const apiImpl = makeApiImpl({
      single: makeOrganization({
        id: expectedCqOrg.id,
        identifier: [{ value: expectedCqOrg.id }],
        active: expectedCqOrg.active,
      }),
    });
    makeCarequalityManagementAPIFhirMock.mockReturnValueOnce(apiImpl);

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

    expect(apiImpl.updateOrganization).toHaveBeenCalledWith(
      expect.objectContaining({
        org: expectedCqOrg,
        oid: epectedOrgDetails.oid,
      })
    );
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
    getCqOrgMock.mockResolvedValueOnce({ name: orgName } as CQDirectoryEntryData);

    const mockedAddress = makeAddressWithCoordinates();
    getAddressWithCoordination.mockImplementation(() => {
      return Promise.resolve(mockedAddress);
    });

    const address = oboFacilityMock.data.address;
    const addressLine = address.addressLine2
      ? `${address.addressLine1}, ${address.addressLine2}`
      : address.addressLine1;

    const epectedOrgDetails = {
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
    const expectedCqOrg = getOrganizationFhirTemplate(epectedOrgDetails);

    const apiImpl = makeApiImpl({
      single: makeOrganization({
        id: expectedCqOrg.id,
        identifier: [{ value: expectedCqOrg.id }],
        active: expectedCqOrg.active,
      }),
    });
    makeCarequalityManagementAPIFhirMock.mockReturnValueOnce(apiImpl);

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

    expect(apiImpl.updateOrganization).toHaveBeenCalledWith(
      expect.objectContaining({
        org: expectedCqOrg,
        oid: epectedOrgDetails.oid,
      })
    );
  });
});
