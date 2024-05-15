/* eslint-disable @typescript-eslint/no-empty-function */
import { faker } from "@faker-js/faker";
import * as uuidv7_file from "@metriport/core/util/uuid-v7";
import { Facility, FacilityType } from "../../../domain/medical/facility";
import { makeFacility } from "../../../domain/medical/__tests__/facility";
import * as getAddress from "../../../domain/medical/address";
import * as getOrg from "../../../command/medical/organization/get-organization";
import * as getCqOboData from "../../../external/carequality/get-obo-data";
import * as createOrUpdateFacility from "../../../command/medical/facility/create-or-update-facility";
import { registerFacilityWithinHIEs } from "../register-facility.ts";
import * as shared from "../shared";
import { getCxOrganizationNameAndOidResult, addressWithCoordinates } from "./register-facility";

let mockedFacility: Facility;
let getCqOboDataMock: jest.SpyInstance;
let createOrUpdateInCqMock: jest.SpyInstance;
let createOrUpdateInCwMock: jest.SpyInstance;

beforeEach(() => {
  mockedFacility = makeFacility({
    type: FacilityType.initiatorOnly,
    cqOboActive: true,
    cqOboOid: faker.string.uuid(),
    cwOboActive: true,
    cwOboOid: faker.string.uuid(),
  });

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
  createOrUpdateInCqMock = jest
    .spyOn(shared, "createOrUpdateInCq")
    .mockImplementation(async () => {});
  createOrUpdateInCwMock = jest
    .spyOn(shared, "createOrUpdateInCw")
    .mockImplementation(async () => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("registerFacility", () => {
  it("creates obo facility in hies when facilityType is initiator_only", async () => {
    const cxId = uuidv7_file.uuidv4();

    getCqOboDataMock.mockResolvedValue({
      enabled: mockedFacility.cqOboActive,
      cqFacilityName: faker.company.name(),
      cqOboOid: faker.string.uuid(),
    });

    await registerFacilityWithinHIEs(cxId, mockedFacility);

    expect(createOrUpdateInCqMock).toHaveBeenCalledWith(
      mockedFacility,
      getCxOrganizationNameAndOidResult.oid,
      expect.stringContaining("OBO"),
      addressWithCoordinates
    );

    expect(createOrUpdateInCwMock).toHaveBeenCalledWith(
      mockedFacility,
      expect.stringContaining("OBO"),
      getCxOrganizationNameAndOidResult.type,
      cxId,
      true
    );
  });

  it("creates obo facility only in cw when facilityType is initiator_only cqOboActive and cqOboOid are not truthy", async () => {
    const cxId = uuidv7_file.uuidv4();
    mockedFacility = makeFacility({
      type: FacilityType.initiatorOnly,
      cwOboActive: true,
      cwOboOid: faker.string.uuid(),
      cqOboActive: false,
      cqOboOid: null,
    });

    getCqOboDataMock.mockResolvedValue({
      enabled: mockedFacility.cqOboActive,
      cqFacilityName: faker.company.name(),
      cqOboOid: faker.string.uuid(),
    });

    await registerFacilityWithinHIEs(cxId, mockedFacility);

    expect(createOrUpdateInCwMock).toHaveBeenCalledWith(
      mockedFacility,
      expect.stringContaining("OBO"),
      getCxOrganizationNameAndOidResult.type,
      cxId,
      true
    );

    expect(createOrUpdateInCqMock).not.toHaveBeenCalled();
  });

  it("creates obo facility only in cq when facilityType is initiator_only cwOboActive and cwOboOid are not truthy", async () => {
    const cxId = uuidv7_file.uuidv4();
    mockedFacility = makeFacility({
      type: FacilityType.initiatorOnly,
      cwOboActive: false,
      cwOboOid: null,
      cqOboActive: true,
      cqOboOid: faker.string.uuid(),
    });

    getCqOboDataMock.mockResolvedValue({
      enabled: mockedFacility.cqOboActive,
      cqFacilityName: faker.company.name(),
      cqOboOid: faker.string.uuid(),
    });

    await registerFacilityWithinHIEs(cxId, mockedFacility);

    expect(createOrUpdateInCwMock).not.toHaveBeenCalled();

    expect(createOrUpdateInCqMock).toHaveBeenCalledWith(
      mockedFacility,
      getCxOrganizationNameAndOidResult.oid,
      expect.stringContaining("OBO"),
      addressWithCoordinates
    );
  });

  it("creates non-obo facility in hies when facilityType is initiator_and_responder", async () => {
    const cxId = uuidv7_file.uuidv4();
    mockedFacility = makeFacility({
      type: FacilityType.initiatorAndResponder,
      cwOboActive: false,
      cwOboOid: null,
      cqOboActive: false,
      cqOboOid: null,
    });

    getCqOboDataMock.mockResolvedValue({
      enabled: mockedFacility.cqOboActive,
      cqFacilityName: faker.company.name(),
      cqOboOid: faker.string.uuid(),
    });

    await registerFacilityWithinHIEs(cxId, mockedFacility);

    expect(createOrUpdateInCwMock).toHaveBeenCalledWith(
      mockedFacility,
      expect.not.stringContaining("OBO"),
      getCxOrganizationNameAndOidResult.type,
      cxId,
      false
    );

    expect(createOrUpdateInCqMock).toHaveBeenCalledWith(
      mockedFacility,
      getCxOrganizationNameAndOidResult.oid,
      expect.not.stringContaining("OBO"),
      addressWithCoordinates
    );
  });
});
