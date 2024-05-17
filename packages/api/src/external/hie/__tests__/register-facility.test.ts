/* eslint-disable @typescript-eslint/no-empty-function */
import { faker } from "@faker-js/faker";
import * as uuidv7_file from "@metriport/core/util/uuid-v7";
import { Facility, FacilityRegister, FacilityType } from "../../../domain/medical/facility";
import { makeFacility } from "../../../domain/medical/__tests__/facility";
import * as getAddress from "../../../domain/medical/address";
import * as getOrg from "../../../command/medical/organization/get-organization";
import * as getCqOboData from "../../../external/carequality/get-obo-data";
import * as createOrUpdateFacility from "../../../command/medical/facility/create-or-update-facility";
import { registerFacilityWithinHIEs } from "../register-facility.ts";
import * as shared from "../shared";
import {
  getCxOrganizationNameAndOidResult,
  addressWithCoordinates,
  coordinates,
} from "./register-facility";
import * as createOrUpdateCqOrg from "../../../external/carequality/command/cq-directory/create-or-update-cq-organization";
import * as createOrUpdateCwOrg from "../../../external/commonwell/create-or-update-cw-organization";
import { CqOboDetails } from "../../../external/carequality/get-obo-data";

let mockedFacility: Facility;
let mockedRegisterFacility: FacilityRegister;
let getCqOboDataMock: jest.SpyInstance;
let createOrUpdateCqOrganizationMock: jest.SpyInstance;
let createOrUpdateCwOrganizationMock: jest.SpyInstance;

beforeEach(() => {
  mockedFacility = makeFacility({
    type: FacilityType.initiatorOnly,
    cqOboActive: true,
    cqOboOid: faker.string.uuid(),
    cwOboActive: true,
    cwOboOid: faker.string.uuid(),
  });

  mockedRegisterFacility = {
    ...mockedFacility,
    cwFacilityName: faker.company.name(),
  };

  jest
    .spyOn(getOrg, "getCxOrganizationNameOidAndType")
    .mockImplementation(async () => getCxOrganizationNameAndOidResult);
  jest
    .spyOn(getAddress, "getAddressWithCoordinates")
    .mockImplementation(async () => addressWithCoordinates);
  getCqOboDataMock = jest.spyOn(getCqOboData, "getCqOboData");
  jest
    .spyOn(createOrUpdateFacility, "createOrUpdateFacility")
    .mockImplementation(async () => mockedFacility);
  createOrUpdateCqOrganizationMock = jest
    .spyOn(createOrUpdateCqOrg, "createOrUpdateCQOrganization")
    .mockImplementation(async () => "");
  createOrUpdateCwOrganizationMock = jest
    .spyOn(createOrUpdateCwOrg, "createOrUpdateCWOrganization")
    .mockImplementation(async () => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("registerFacility", () => {
  it("calls hie creates with expected params when registerFacilityWithinHIEs is called", async () => {
    const cxId = uuidv7_file.uuidv4();

    const getCqOboDataMockData = {
      enabled: mockedRegisterFacility.cqOboActive,
      cqFacilityName: faker.company.name(),
      cqOboOid: faker.string.uuid(),
    };

    const createOrUpdateInCqMock = jest
      .spyOn(shared, "createOrUpdateInCq")
      .mockImplementation(async () => {});

    const createOrUpdateInCwMock = jest
      .spyOn(shared, "createOrUpdateInCw")
      .mockImplementation(async () => {});

    getCqOboDataMock.mockResolvedValue(getCqOboDataMockData);

    await registerFacilityWithinHIEs(cxId, mockedRegisterFacility);

    expect(createOrUpdateInCqMock).toHaveBeenCalledWith(
      mockedFacility,
      getCxOrganizationNameAndOidResult,
      getCqOboDataMockData,
      coordinates
    );

    expect(createOrUpdateInCwMock).toHaveBeenCalledWith(
      mockedFacility,
      mockedRegisterFacility.cwFacilityName,
      getCxOrganizationNameAndOidResult,
      cxId
    );
  });

  it("calls createOrUpdateInCq with name containing OBO when isObo and cqOboData.enabled to true", async () => {
    mockedFacility = {
      ...mockedFacility,
      type: FacilityType.initiatorOnly,
    };

    const getCqOboDataMockData: CqOboDetails = {
      enabled: true,
      cqFacilityName: faker.company.name(),
      cqOboOid: faker.string.uuid(),
    };

    await shared.createOrUpdateInCq(
      mockedFacility,
      getCxOrganizationNameAndOidResult,
      getCqOboDataMockData,
      coordinates
    );

    expect(createOrUpdateCqOrganizationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        name: expect.stringContaining("OBO"),
      })
    );
  });

  it("calls createOrUpdateInCq with name not containing OBO when isProvider and cqOboData.enabled to true", async () => {
    mockedFacility = {
      ...mockedFacility,
      type: FacilityType.initiatorAndResponder,
    };

    const getCqOboDataMockData: CqOboDetails = {
      enabled: true,
      cqFacilityName: faker.company.name(),
      cqOboOid: faker.string.uuid(),
    };

    await shared.createOrUpdateInCq(
      mockedFacility,
      getCxOrganizationNameAndOidResult,
      getCqOboDataMockData,
      coordinates
    );

    expect(createOrUpdateCqOrganizationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        name: expect.not.stringContaining("OBO"),
      })
    );
  });

  it("returns createOrUpdateInCq early when its an obo but cqObo not enabled", async () => {
    mockedFacility = {
      ...mockedFacility,
      type: FacilityType.initiatorOnly,
    };

    const getCqOboDataMockData: CqOboDetails = {
      enabled: false,
    };

    await shared.createOrUpdateInCq(
      mockedFacility,
      getCxOrganizationNameAndOidResult,
      getCqOboDataMockData,
      coordinates
    );

    expect(createOrUpdateCqOrganizationMock).not.toHaveBeenCalled();
  });

  it("calls createOrUpdateInCw with name containing OBO when isObo and cwOboActive are true and cwOboOid is present ", async () => {
    const cxId = uuidv7_file.uuidv4();

    mockedFacility = {
      ...mockedFacility,
      type: FacilityType.initiatorOnly,
      cwOboActive: true,
      cwOboOid: faker.string.uuid(),
    };

    await shared.createOrUpdateInCw(
      mockedFacility,
      mockedRegisterFacility.cwFacilityName,
      getCxOrganizationNameAndOidResult,
      cxId
    );

    expect(createOrUpdateCwOrganizationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: expect.stringContaining("OBO"),
        }),
      }),
      true
    );
  });

  it("calls createOrUpdateInCw with name not containing OBO when isProvider and cwOboActive are true and cwOboOid is present ", async () => {
    const cxId = uuidv7_file.uuidv4();

    mockedFacility = {
      ...mockedFacility,
      type: FacilityType.initiatorAndResponder,
      cwOboActive: true,
      cwOboOid: faker.string.uuid(),
    };

    await shared.createOrUpdateInCw(
      mockedFacility,
      mockedRegisterFacility.cwFacilityName,
      getCxOrganizationNameAndOidResult,
      cxId
    );

    expect(createOrUpdateCwOrganizationMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: expect.not.stringContaining("OBO"),
        }),
      }),
      false
    );
  });

  it("returns createOrUpdateInCw early when its an obo but cwOboActive or cwOboOid are falsy", async () => {
    const cxId = uuidv7_file.uuidv4();

    mockedFacility = {
      ...mockedFacility,
      type: FacilityType.initiatorOnly,
      cwOboActive: false,
      cwOboOid: null,
    };

    await shared.createOrUpdateInCw(
      mockedFacility,
      mockedRegisterFacility.cwFacilityName,
      getCxOrganizationNameAndOidResult,
      cxId
    );

    expect(createOrUpdateCwOrganizationMock).not.toHaveBeenCalled();
  });
});
