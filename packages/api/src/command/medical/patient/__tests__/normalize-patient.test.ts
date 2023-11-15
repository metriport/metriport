import { PatientData } from "../../../../domain/medical/patient";
import { normalizePatientData } from "../normalize-patient";
import { Address } from "../../../../domain/medical/address";

describe("normalizePatientData", () => {
  // Should return the same patient data if no normalization is needed
  it("should lowercase name and address and alter street suffix", () => {
    const patientData: PatientData = {
      firstName: "John",
      lastName: "Dogo",
      dob: "1990-01-01",
      genderAtBirth: "M",
      address: [
        {
          addressLine1: "123 Elm Street",
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
      lastName: "dogo",
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
          addressLine1: "123 elm St",
          city: "new york",
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
          addressLine1: "123 elm st",
          city: "new york",
          zip: "10001",
        },
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

  // Should normalize email addresses to lowercase and remove leading/trailing whitespaces
  it("should normalize email addresses to lowercase and remove leading/trailing whitespaces", () => {
    const patientData: PatientData = {
      firstName: "john   ",
      lastName: "dogo    ",
      dob: "1990-01-01",
      genderAtBirth: "M",
      address: [
        {
          addressLine1: "123 elm st    ",
          city: "   new york     ",
          zip: "10001",
        } as Address,
      ],
      contact: [
        {
          email: "  JOHN.DOE@example.com  ",
          phone: "1234567890",
        },
      ],
    };

    const expected: PatientData = {
      firstName: "john",
      lastName: "dogo",
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

  // Should handle default values for first name, last name, and address
  it("should handle default values for first name, last name, and return null", () => {
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

// Should return null if the patient has a default address
it("should handle default address values", () => {
  const patientData: PatientData = {
    firstName: "John",
    lastName: "Doe",
    dob: "1990-01-01",
    genderAtBirth: "M",
    address: [
      {
        addressLine1: "123 main street",
        city: "anytown",
        zip: "00000",
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
  expect(result).toBeNull();
});

// Should return null if the patient has default contact values
it("should handle default contact values and remove period from street", () => {
  const patientData: PatientData = {
    firstName: "john",
    lastName: "dogo",
    dob: "1990-01-01",
    genderAtBirth: "M",
    address: [
      {
        addressLine1: "123 elm st.",
        city: "new york",
        zip: "10001",
      } as Address,
    ],
    contact: [
      {
        email: "example@example.com",
        phone: "0000000000",
      },
    ],
  };

  const expected: PatientData = {
    firstName: "john",
    lastName: "dogo",
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
        email: "",
        phone: "",
      },
    ],
  };

  const result = normalizePatientData(patientData);
  expect(result).toEqual(expected);
});
