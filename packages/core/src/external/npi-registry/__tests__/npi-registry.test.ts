import { USState } from "@metriport/shared/domain/address/state";
import {
  AdditionalInformationInternalFacility,
  NpiRegistryFacility,
} from "../../../domain/npi-facility";
import { FacilityType, FacilityInternalDetails } from "../../../domain/facility";
import { getFacilityByNpiOrFail, translateNpiFacilityToMetriportFacility } from "../npi-registry";
import { toTitleCase } from "@metriport/shared/common/title-case";
import axios from "axios";
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
    const validInternalNonObo: FacilityInternalDetails = {
      city: "Shoreline",
      state: USState.WA,
      nameInMetriport: "Test Name",
      npi: "1407380272",
      cqType: FacilityType.initiatorAndResponder,
      cwType: FacilityType.initiatorAndResponder,
      addressLine1: toTitleCase("17020 AURORA AVE N UNIT C44"),
      zip: "98133",
      country: "USA",
      cqActive: false,
      cwActive: false,
      cqApproved: false,
      cwApproved: false,
    };

    const additionalInfoNonObo: AdditionalInformationInternalFacility = {
      facilityName: "Test Name",
      facilityType: "non-obo",
      cqActive: false,
      cwActive: false,
    };

    const internalNonObo = translateNpiFacilityToMetriportFacility(
      validFacility,
      additionalInfoNonObo
    );

    expect(validInternalNonObo).toEqual(internalNonObo);

    const validInternalObo: FacilityInternalDetails = {
      city: "Shoreline",
      state: USState.WA,
      nameInMetriport: "Test Name",
      npi: "1407380272",
      cqType: FacilityType.initiatorOnly,
      cwType: FacilityType.initiatorOnly,
      addressLine1: toTitleCase("17020 AURORA AVE N UNIT C44"),
      zip: "98133",
      country: "USA",
      cqOboOid: "1.2.3.4.5.6.7.8.9",
      cwOboOid: "1.2.3.4.5.6.7.8.9",
      cqActive: false,
      cwActive: false,
      cqApproved: false,
      cwApproved: false,
    };

    const additionalInfoObo: AdditionalInformationInternalFacility = {
      facilityName: "Test Name",
      facilityType: "obo",
      cqOboOid: "1.2.3.4.5.6.7.8.9",
      cwOboOid: "1.2.3.4.5.6.7.8.9",
      cqActive: false,
      cwActive: false,
    };

    const internalObo = translateNpiFacilityToMetriportFacility(validFacility, additionalInfoObo);

    expect(validInternalObo).toEqual(internalObo);
  });
});
