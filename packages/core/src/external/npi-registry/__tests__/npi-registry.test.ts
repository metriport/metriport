import { toTitleCase } from "@metriport/shared/common/title-case";
import { USState } from "@metriport/shared/domain/address/state";
import axios from "axios";
import { FacilityInternalDetails, FacilityType } from "../../../domain/facility";
import {
  AdditionalInformationInternalFacility,
  NpiRegistryFacility,
} from "../../../domain/npi-facility";
import { getFacilityByNpiOrFail, buildInternalFacilityFromNpiFacility } from "../npi-registry";
jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe("Npi Registry Validation", () => {
  beforeEach(() => jest.clearAllMocks());

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const validFacility: NpiRegistryFacility = {
    number: "1407380272",
    addresses: [
      {
        country_code: "US",
        address_1: "17020 AURORA AVE N UNIT C44",
        city: "SHORELINE",
        state: "WA",
        postal_code: "981335352",
        telephone_number: "425-354-7560",
      },
      {
        country_code: "US",
        address_1: "1959 NE PACIFIC ST",
        city: "SEATTLE",
        state: "WA",
        postal_code: "981951802",
        telephone_number: "206-543-2100",
      },
    ],
    other_names: [
      {
        organization_name: "Test Name",
      },
    ],
  };

  it("successfully returns valid facility", async () => {
    mockedAxios.get.mockResolvedValueOnce({
      data: { result_count: "1", results: [validFacility] },
    } as any); //eslint-disable-line @typescript-eslint/no-explicit-any

    const npi = "1407380272";
    const npiFacility = await getFacilityByNpiOrFail(npi);

    expect(npiFacility).toMatchObject({
      number: validFacility.number,
      addresses: validFacility.addresses,
    });
  });

  it("successfully fails on invalid npi", async () => {
    const tooShortNpi = "140738";
    const tooLongNpi = "14073802722415";
    const notValidLuhnNpi = "1000000000";
    const nonExistentFacilityNpi = "2893252884";

    const invalidMsg =
      "NPI is invalid. Make sure the npi is exactly 10 digits and is valid under standard mod 10 Luhn algorithm.";

    expect.assertions(4);

    await expect(getFacilityByNpiOrFail(tooShortNpi)).rejects.toThrow(invalidMsg);

    await expect(getFacilityByNpiOrFail(tooLongNpi)).rejects.toThrow(invalidMsg);

    await expect(getFacilityByNpiOrFail(notValidLuhnNpi)).rejects.toThrow(invalidMsg);

    mockedAxios.get.mockResolvedValueOnce({
      data: { result_count: "0", results: [] },
    } as any); //eslint-disable-line @typescript-eslint/no-explicit-any

    await expect(getFacilityByNpiOrFail(nonExistentFacilityNpi)).rejects.toThrow(
      "NPI Registry error. No facilities found."
    );
  });

  it("successfully translates npi registry facility to our internal create facility mapping", () => {
    const validInternalPrincipal: FacilityInternalDetails = {
      city: "Shoreline",
      state: USState.WA,
      nameInMetriport: "Test Name",
      npi: "1407380272",
      type: FacilityType.initiatorAndResponder,
      addressLine1: toTitleCase("17020 AURORA AVE N UNIT C44"),
      zip: "98133",
      country: "USA",
      cqActive: false,
      cwActive: false,
      cqApproved: false,
      cwApproved: false,
    };

    const additionalInfoWithoutPrincipalOid: AdditionalInformationInternalFacility = {
      facilityName: "Test Name",
      type: FacilityType.initiatorAndResponder,
      cqActive: false,
      cwActive: false,
    };

    const internalNonObo = buildInternalFacilityFromNpiFacility({
      npiFacility: validFacility,
      additionalInfo: additionalInfoWithoutPrincipalOid,
    });

    expect(validInternalPrincipal).toEqual(internalNonObo);

    const validInternalDelegate: FacilityInternalDetails = {
      city: "Shoreline",
      state: USState.WA,
      nameInMetriport: "Test Name",
      npi: "1407380272",
      type: FacilityType.initiatorOnly,
      addressLine1: toTitleCase("17020 AURORA AVE N UNIT C44"),
      zip: "98133",
      country: "USA",
      cqActive: false,
      cwActive: false,
      cqApproved: false,
      cwApproved: false,
      principalOid: "1.2.3.4.5.6.7.8.9",
    };

    const additionalInfoWithPrincipalOid: AdditionalInformationInternalFacility = {
      facilityName: "Test Name",
      type: FacilityType.initiatorOnly,
      principalOid: "1.2.3.4.5.6.7.8.9",
      cqActive: false,
      cwActive: false,
    };

    const internalObo = buildInternalFacilityFromNpiFacility({
      npiFacility: validFacility,
      additionalInfo: additionalInfoWithPrincipalOid,
    });
    expect(validInternalDelegate).toEqual(internalObo);
  });
});
