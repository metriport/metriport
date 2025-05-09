import { faker } from "@faker-js/faker";
import { USState } from "@metriport/shared";
import { makePatient } from "../../../domain/__tests__/patient";
import { Address } from "../../../domain/address";
import { convertPatientsToHieFormat, packIdAndCxId } from "../hl7v2-roster-generator";

const states = [USState.MA];

describe("AdtRosterGenerator", () => {
  describe("convertToHieFormat", () => {
    const mockSchema = {
      scrambledId: "ID",
      firstName: "FIRST NAME",
      lastName: "LAST NAME",
      dob: "DOB",
      genderAtBirth: "GENDER",
      address: [
        {
          addressLine1: "STREET ADDRESS",
          addressLine2: "STREET NUMBER",
          city: "CITY",
          state: "STATE",
          zip: "ZIP",
        },
      ],
      phone: "PHONE",
      email: "EMAIL",
      ssn: "SSN",
      driversLicense: "DRIVERS LICENSE",
    };

    const baseAddress: Address = {
      addressLine1: "123 Main St",
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

    it("should convert all fields correctly including multiple addresses and identifiers", () => {
      const patientId = faker.string.uuid();
      const cxId = faker.string.uuid();
      const scrambledId = packIdAndCxId(cxId, patientId);

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

      const subscribers = [patient];
      const result = convertPatientsToHieFormat(subscribers, mockSchema, states);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        ID: scrambledId,
        "FIRST NAME": "John",
        "LAST NAME": "Doe",
        "STREET ADDRESS": baseAddress.addressLine1,
        CITY: baseAddress.city,
        STATE: baseAddress.state,
        ZIP: baseAddress.zip,
        SSN: "123-45-6789",
        "DRIVERS LICENSE": "DL123456",
        DOB: "1990-01-01",
        GENDER: "M",
        PHONE: "600-700-8000",
        EMAIL: "john@doe.com",
      });
    });

    it("should handle missing optional fields", () => {
      const patientId = faker.string.uuid();
      const cxId = faker.string.uuid();
      const scrambledId = packIdAndCxId(cxId, patientId);

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

      const subscribers = [patient];
      const result = convertPatientsToHieFormat(subscribers, mockSchema, states);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        ID: scrambledId,
        "FIRST NAME": "Jane",
        "LAST NAME": "Smith",
        "STREET ADDRESS": baseAddress.addressLine1,
        CITY: baseAddress.city,
        STATE: baseAddress.state,
        ZIP: baseAddress.zip,
        DOB: "1985-12-31",
        GENDER: "F",
      });
    });

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

      const patientId = faker.string.uuid();
      const cxId = faker.string.uuid();
      const scrambledId = packIdAndCxId(cxId, patientId);

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

      const subscribers = [patient];
      const result = convertPatientsToHieFormat(subscribers, mockSchema, states);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        ID: scrambledId,
        "FIRST NAME": "Jane",
        "LAST NAME": "Smith",
        "STREET ADDRESS": baseAddress.addressLine1,
        CITY: baseAddress.city,
        STATE: baseAddress.state,
        ZIP: baseAddress.zip,
        DOB: "1985-12-31",
        GENDER: "F",
      });
    });
  });
});
