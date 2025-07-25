import { faker } from "@faker-js/faker";
import { USState } from "@metriport/shared";
import _ from "lodash";
import { makePatient } from "../../../domain/__tests__/patient";
import { Address } from "../../../domain/address";
import * as rosterGeneratorModule from "../hl7v2-roster-generator";
import * as packIdsModule from "../utils";
import { HiePatientRosterMapping } from "../types";

const states = [USState.MA];

describe("AdtRosterGenerator", () => {
  let scrambleIdMock: jest.SpyInstance;
  let patientId: string;
  let cxId: string;
  let scrambledId: string;

  const mockMinimalSchema: HiePatientRosterMapping = {
    ID: "scrambledId",
    "FIRST NAME": "firstName",
    "LAST NAME": "lastName",
    DOB: "dob",
  };

  const mockSchema: HiePatientRosterMapping = {
    ...mockMinimalSchema,
    GENDER: "genderAtBirth",
    "STREET ADDRESS": "address1AddressLine1", // TODO: remove this
    "STREET NUMBER": "address1AddressLine2",
    CITY: "address1City",
    STATE: "address1State",
    ZIP: "address1Zip",
    PHONE: "phone",
    EMAIL: "email",
    SSN: "ssn",
    "DRIVERS LICENSE": "driversLicense",
    "AUTHORIZING PARTICIPANT FACILITY CODE": "cxShortcode",
    "ASSIGNING AUTHORITY IDENTIFIER": "assigningAuthorityIdentifier",
  };

  const baseAddress: Address = {
    addressLine1: "123 Main St",
    addressLine2: "Unit 1",
    city: "Boston",
    state: USState.MA,
    zip: "02108",
    country: "USA",
  };

  const secondaryAddress: Address = {
    addressLine1: "456 Oak St",
    addressLine2: "#101",
    city: "Cambridge",
    state: USState.MA,
    zip: "02139",
    country: "USA",
  };

  const ssn = "123-45-6789";
  const driversLicense = "DL123456";
  const phoneNumber = "600-700-8000";
  const email = "john@doe.com";

  beforeEach(() => {
    jest.clearAllMocks();
    scrambleIdMock = jest.spyOn(packIdsModule, "createScrambledId");
    patientId = faker.string.uuid();
    cxId = faker.string.uuid();
    scrambledId = `${cxId}_${patientId}`;
    scrambleIdMock.mockReturnValueOnce(scrambledId);
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  describe("createRosterRowInput", () => {
    it("should only keep addresses from relevant states", () => {
      const secondaryAddress: Address = {
        addressLine1: "123 TX st",
        city: "Austin",
        state: USState.TX,
        zip: "98765",
        country: "USA",
      };

      const tertiaryAddress: Address = {
        addressLine1: "123 CA st",
        city: "Los Angeles",
        state: USState.CA,
        zip: "12345",
        country: "USA",
      };

      const patient = makePatient({
        id: patientId,
        cxId,
        data: {
          firstName: "Jane",
          lastName: "Smith",
          dob: "1985-12-31",
          genderAtBirth: "F",
          address: [secondaryAddress, baseAddress, tertiaryAddress],
        },
      });
      delete patient.data.contact;
      delete patient.data.personalIdentifiers;

      const input = rosterGeneratorModule.createRosterRowInput(
        patient,
        { shortcode: "TEST" },
        states
      );

      expect(
        _.isMatch(input, {
          address1AddressLine1: baseAddress.addressLine1,
          address1AddressLine2: baseAddress.addressLine2,
          address1City: baseAddress.city,
          address1State: baseAddress.state,
          address1Zip: baseAddress.zip,
        })
      ).toBe(true);
    });
  });

  describe("createRosterRow", () => {
    it("should convert all fields correctly including multiple addresses and identifiers", () => {
      const patient = makePatient({
        id: patientId,
        cxId,
        data: {
          firstName: "John",
          lastName: "Doe",
          dob: "1990-01-01",
          genderAtBirth: "M",
          address: [baseAddress, secondaryAddress],
          personalIdentifiers: [
            { type: "ssn", value: ssn },
            { type: "driversLicense", state: USState.MA, value: driversLicense },
          ],
          contact: [
            {
              phone: phoneNumber,
              email,
            },
          ],
        },
      });

      const input = rosterGeneratorModule.createRosterRowInput(
        patient,
        { shortcode: "TESTCODE" },
        states
      );

      const result = rosterGeneratorModule.createRosterRow(input, mockSchema);

      expect(result).toEqual({
        ID: scrambledId,
        "FIRST NAME": "John",
        "LAST NAME": "Doe",
        "STREET ADDRESS": baseAddress.addressLine1,
        "STREET NUMBER": baseAddress.addressLine2,
        CITY: baseAddress.city,
        STATE: baseAddress.state,
        ZIP: baseAddress.zip,
        SSN: "123-45-6789",
        "DRIVERS LICENSE": "DL123456",
        DOB: "1990-01-01",
        GENDER: "M",
        PHONE: "600-700-8000",
        EMAIL: "john@doe.com",
        "AUTHORIZING PARTICIPANT FACILITY CODE": "TESTCODE",
        "ASSIGNING AUTHORITY IDENTIFIER": "METRIPORT",
      });
    });

    it("should include empty strings for fields present in the schema but not in the patient", () => {
      const patient = makePatient({
        id: patientId,
        cxId,
        data: {
          firstName: "Jane",
          lastName: "Smith",
          dob: "1985-12-31",
          genderAtBirth: "F",
          address: [baseAddress],
        },
      });
      delete patient.data.contact;
      delete patient.data.personalIdentifiers;

      const input = rosterGeneratorModule.createRosterRowInput(
        patient,
        { shortcode: "TEST" },
        states
      );

      const result = rosterGeneratorModule.createRosterRow(input, mockSchema);

      expect(scrambleIdMock).toHaveBeenCalledTimes(1);
      expect(
        _.isMatch(result, {
          "DRIVERS LICENSE": "",
          EMAIL: "",
          PHONE: "",
          SSN: "",
          GENDER: "F",
        })
      ).toBe(true);
    });
  });
});
