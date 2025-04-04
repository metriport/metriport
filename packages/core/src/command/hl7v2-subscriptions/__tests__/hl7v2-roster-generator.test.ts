import { USState } from "@metriport/shared";
import { Address } from "../../../domain/address";
import { Hl7v2Subscriber } from "../../../domain/patient-settings";
import { convertSubscribersToHieFormat } from "../hl7v2-roster-generator";

describe("AdtRosterGenerator", () => {
  describe("convertToHieFormat", () => {
    const mockSchema = {
      firstName: "FIRST NAME",
      lastName: "LAST NAME",
      dob: "DOB",
      genderAtBirth: "GENDER",
      "address[0].addressLine2": "STREET NUMBER",
      "address[0].addressLine1": "STREET ADDRESS",
      "address[0].city": "CITY",
      "address[0].state": "STATE",
      "address[0].zip": "ZIP",
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
      const subscribers: Hl7v2Subscriber[] = [
        {
          id: "123",
          cxId: "cx123",
          firstName: "John",
          lastName: "Doe",
          dob: "1990-01-01",
          genderAtBirth: "M",
          address: [baseAddress, secondaryAddress],
          ssn,
          driversLicense,
          phone: phoneNumber,
          email,
        },
      ];

      const result = convertSubscribersToHieFormat(subscribers, mockSchema);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        "FIRST NAME": "John",
        "LAST NAME": "Doe",
        "STREET ADDRESS": "123 Main St",
        CITY: "Boston",
        STATE: "MA",
        ZIP: "02108",
        SSN: "123-45-6789",
        "DRIVERS LICENSE": "DL123456",
        DOB: "1990-01-01",
        GENDER: "M",
        PHONE: "600-700-8000",
        EMAIL: "john@doe.com",
      });
    });

    it("should handle missing optional fields", () => {
      const subscribers: Hl7v2Subscriber[] = [
        {
          id: "456",
          cxId: "cx456",
          firstName: "Jane",
          lastName: "Smith",
          dob: "1985-12-31",
          genderAtBirth: "F",
          address: [baseAddress],
        },
      ];

      const result = convertSubscribersToHieFormat(subscribers, mockSchema);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        "FIRST NAME": "Jane",
        "LAST NAME": "Smith",
        "STREET NUMBER": undefined,
        "STREET ADDRESS": "123 Main St",
        CITY: "Boston",
        STATE: "MA",
        ZIP: "02108",
        DOB: "1985-12-31",
        GENDER: "F",
      });
    });
  });
});
