import { PatientData } from "../../../../domain/medical/patient";
import { normalizePatientData } from "../normalize-patient";
import { Address } from "../../../../domain/medical/address";

describe("normalizePatientData", () => {
  // Should return the same patient data if no normalization is needed
  it("should return the same patient data when no normalization is needed", () => {
    const patientData: PatientData = {
      firstName: "John",
      lastName: "Doe",
      dob: "1990-01-01",
      genderAtBirth: "M",
      address: [
        {
          addressLine1: "123 Elm St",
          city: "New York",
          zip: "10001",
        } as Address,
      ],
      contact: [
        {
          email: "john.doe@example.com",
          phone: "123-456-7890",
        },
      ],
    };

    const expected: PatientData = {
      firstName: "john",
      lastName: "doe",
      dob: "1990-01-01",
      genderAtBirth: "M",
      address: [
        {
          addressLine1: "123 elm st",
          city: "new york",
          zip: "10001",
        } as Address,
      ],
      contact: [
        {
          email: "john.doe@example.com",
          phone: "1234567890",
        },
      ],
    };

    const result = normalizePatientData(patientData);

    expect(result).toEqual(expected);
  });

  // Should normalize first and last name to lowercase and remove apostrophes and hyphens
  it("should normalize first and last name to lowercase and remove apostrophes and hyphens", () => {
    const patientData: PatientData = {
      firstName: "John-O'Connor",
      lastName: "Doe-Smith",
      dob: "1990-01-01",
      genderAtBirth: "M",
      address: [
        {
          addressLine1: "123 Elm St",
          city: "New York",
          zip: "10001",
        },
      ],
      contact: [
        {
          email: "john.doe@example.com",
          phone: "123-456-7890",
        },
      ],
    };

    const expected: PatientData = {
      firstName: "johnoconnor",
      lastName: "doesmith",
      dob: "1990-01-01",
      genderAtBirth: "M",
      address: [
        {
          addressLine1: "123 Main St",
          city: "New York",
          zip: "10001",
        },
      ],
      contact: [
        {
          email: "john.doe@example.com",
          phone: "123-456-7890",
        },
      ],
    };

    const result = normalizePatientData(patientData);

    expect(result).toEqual(expected);
  });

  // Should normalize email addresses to lowercase and remove leading/trailing whitespaces
  it("should normalize email addresses to lowercase and remove leading/trailing whitespaces", () => {
    const patientData: PatientData = {
      firstName: "John",
      lastName: "Doe",
      dob: "1990-01-01",
      genderAtBirth: "M",
      address: [
        {
          addressLine1: "123 Main St",
          city: "New York",
          zip: "10001",
        },
      ],
      contact: [
        {
          email: "  JOHN.DOE@example.com  ",
          phone: "123-456-7890",
        },
      ],
    };

    const expected: PatientData = {
      firstName: "John",
      lastName: "Doe",
      dob: "1990-01-01",
      genderAtBirth: "M",
      address: [
        {
          addressLine1: "123 Main St",
          city: "New York",
          zip: "10001",
        },
      ],
      contact: [
        {
          email: "john.doe@example.com",
          phone: "123-456-7890",
        },
      ],
    };

    const result = normalizePatientData(patientData);

    expect(result).toEqual(expected);
  });

  // // Should handle null or undefined values for all fields
  // it('should handle null or undefined values for all fields', () => {
  //   const patientData = {
  //     firstName: "",
  //     lastName: "",
  //     dob: "",
  //     genderAtBirth: "M",
  //     address: "",
  //     contact: undefined
  //   };

  //   const expected = {
  //     firstName: null,
  //     lastName: undefined,
  //     dob: null,
  //     genderAtBirth: undefined,
  //     address: null,
  //     contact: undefined
  //   };

  //   const result = normalizePatientData(patientData);

  //   expect(result).toEqual(expected);
  // });

  // // Should handle empty arrays for all fields
  // it('should handle empty arrays for all fields', () => {
  //   const patientData: PatientData = {
  //     firstName: "",
  //     lastName: "",
  //     dob: "",
  //     genderAtBirth: "M",
  //     address: [],
  //     contact: []
  //   };

  //   const expected = {
  //     firstName: "",
  //     lastName: "",
  //     dob: "",
  //     genderAtBirth: "",
  //     address: [],
  //     contact: []
  //   };

  //   const result = normalizePatientData(patientData);

  //   expect(result).toEqual(expected);
  // });

  // Should handle default values for first name, last name, and address
  it("should handle default values for first name, last name, and address", () => {
    const patientData: PatientData = {
      firstName: "John",
      lastName: "Doe",
      dob: "1990-01-01",
      genderAtBirth: "M",
      address: [
        {
          addressLine1: "123 Main St",
          city: "New York",
          zip: "10001",
        },
      ],
      contact: [
        {
          email: "john.doe@example.com",
          phone: "123-456-7890",
        },
      ],
    };

    const expected = null;

    const result = normalizePatientData(patientData);

    expect(result).toEqual(expected);
  });
});
