import { Address } from "../../domain/address";
import { Contact } from "../../domain/contact";
import { USState } from "../../domain/geographic-locations";
import { GenderAtBirth } from "../../domain/patient";
import { normalizePatient, normalizePhoneNumber } from "../normalize-patient";
import { PatientMPI } from "../shared";

describe("normalizePatient", () => {
  describe("normalizePatient email normalization", () => {
    it("should normalize email addresses to lowercase and remove leading/trailing whitespaces", () => {
      const patientMPI = makePatientMPI({
        contact: [{ email: "  JOHN.DOE@example.com  " }],
      });

      const expected = makePatientMPI({
        contact: [{ email: "john.doe@example.com" }],
      });

      const result = normalizePatient(patientMPI);
      expect(result.contact?.[0]?.email).toEqual(expected.contact?.[0]?.email);
    });

    it("should leave the email field unchanged if it is empty", () => {
      const patientMPI = makePatientMPI({
        contact: [{ email: "" }],
      });

      const expected = makePatientMPI({
        contact: [{ email: "" }],
      });

      const result = normalizePatient(patientMPI);
      expect(result.contact?.[0]?.email).toEqual(expected.contact?.[0]?.email);
    });

    it("should leave the email field unchanged if it is not provided", () => {
      const patientMPI = makePatientMPI({
        contact: [{}], // No email provided
      });

      const expected = makePatientMPI({
        contact: [{}], // Expect no changes to the email field
      });

      const result = normalizePatient(patientMPI);
      expect(result.contact?.[0]?.email).toEqual(expected.contact?.[0]?.email);
    });

    it("should handle invalid email formats gracefully", () => {
      const patientMPI = makePatientMPI({
        contact: [{ email: "invalid-email" }],
      });

      const expected = makePatientMPI({
        contact: [{ email: "invalid-email" }],
      });

      const result = normalizePatient(patientMPI);
      expect(result.contact?.[0]?.email).toEqual(expected.contact?.[0]?.email);
    });

    it("should not remove spaces in the middle of the email", () => {
      const patientMPI = makePatientMPI({
        contact: [{ email: "john .doe@example.com" }],
      });

      const expected = makePatientMPI({
        contact: [{ email: "john .doe@example.com" }],
      });

      const result = normalizePatient(patientMPI);
      expect(result.contact?.[0]?.email).toEqual(expected.contact?.[0]?.email);
    });

    // Add more test cases as needed for different scenarios
  });

  describe("normalizePatient", () => {
    it("should lowercase name and address and alter street suffix", () => {
      const patientMPI = makePatientMPI({
        firstName: "John",
        lastName: "Dogo",
        address: [{ addressLine1: "123 Elm Street" }],
      });

      const expected = makePatientMPI({
        firstName: "john",
        lastName: "dogo",
        address: [{ addressLine1: "123 elm street" }],
      });

      const result = normalizePatient(patientMPI);
      expect(result).toEqual(expected);
    });

    it("should normalize first and last name to lowercase", () => {
      const patientMPI = makePatientMPI({
        firstName: "John",
        lastName: " Smith",
        address: [{ addressLine1: "123 elm St" }],
      });

      const expected = makePatientMPI({
        firstName: "john",
        lastName: "smith",
        address: [{ addressLine1: "123 elm st" }],
      });

      const result = normalizePatient(patientMPI);
      expect(result).toEqual(expected);
    });

    it("should normalize email addresses to lowercase and remove leading/trailing whitespaces", () => {
      const patientMPI = makePatientMPI({
        firstName: "john   ",
        lastName: "dogo    ",
        address: [{ addressLine1: "123 elm st    ", city: "   new york     " }],
        contact: [{ email: "  JOHN.DOE@example.com  " }],
      });

      const expected = makePatientMPI({
        firstName: "john",
        lastName: "dogo",
        address: [{ addressLine1: "123 elm st", city: "new york" }],
        contact: [{ email: "john.doe@example.com" }],
      });

      const result = normalizePatient(patientMPI);
      expect(result).toEqual(expected);
    });
  });

  describe("normalize phone number", () => {
    it("returns original value when it contains 10 digits", () => {
      const expectedPhone = "0987654321";
      const result = normalizePhoneNumber(expectedPhone);
      expect(result).toEqual(expectedPhone);
    });

    it("removes country code when its 1 and contains 11 digits", () => {
      const expectedPhone = "0987654321";
      const result = normalizePhoneNumber("1" + expectedPhone);
      expect(result).toEqual(expectedPhone);
    });

    it("returns original value when code is not 1 and it contains 11 digits", () => {
      const expectedPhone = "20987654321";
      const result = normalizePhoneNumber(expectedPhone);
      expect(result).toEqual(expectedPhone);
    });

    it("returns original value when it contains 12 digits", () => {
      const expectedPhone = "109876543210";
      const result = normalizePhoneNumber(expectedPhone);
      expect(result).toEqual(expectedPhone);
    });

    it("removes non-digits and returns original value not US phone w/ 11 digits", () => {
      const inputPhone = " a0987b6543-21 ext 0123 ";
      const expectedPhone = "09876543210123";
      const result = normalizePhoneNumber(inputPhone);
      expect(result).toEqual(expectedPhone);
    });

    it("removes non-digits and returns updates value when its a US phone w/ 11 digits", () => {
      const inputPhone = " a1987b6543-210 ";
      const expectedPhone = "9876543210";
      const result = normalizePhoneNumber(inputPhone);
      expect(result).toEqual(expectedPhone);
    });
  });
});

function makePatientMPI(
  overrides: {
    id?: string;
    firstName?: string;
    lastName?: string;
    dob?: string;
    genderAtBirth?: GenderAtBirth;
    address?: (Partial<Address> & { addressLine1: string })[]; // Ensure addressLine1 is always provided
    contact?: Partial<Contact>[];
  } = {}
): PatientMPI {
  const defaultAddress: Address = {
    addressLine1: "123 Elm Street",
    city: "new york",
    zip: "10001",
    state: USState.NY,
    country: "USA",
  };

  const defaultContact: Contact = {
    email: "john.doe@example.com",
    phone: "1234567890",
  };

  const defaultPatient: PatientMPI = {
    id: "123456789",
    firstName: "John",
    lastName: "Doe",
    dob: "1990-01-01",
    genderAtBirth: "M" as GenderAtBirth,
    address: [defaultAddress],
    contact: [defaultContact],
  };

  // Merge nested objects carefully
  const mergedPatient = { ...defaultPatient, ...overrides };
  if (overrides.address) {
    mergedPatient.address = overrides.address.map(addr => ({ ...defaultAddress, ...addr }));
  }
  if (overrides.contact) {
    mergedPatient.contact = overrides.contact.map(cont => ({ ...defaultContact, ...cont }));
  }

  return mergedPatient as PatientMPI;
}
