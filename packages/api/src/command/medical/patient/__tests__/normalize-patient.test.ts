import { PatientDataMPI } from "@metriport/core/mpi/patient";
import { normalizePatient } from "@metriport/core/mpi/normalize-patient";
import { USState } from "@metriport/core/domain/geographic-locations";

describe("normalizePatient", () => {
  // Should return the same patient data if no normalization is needed
  it("should lowercase name and address and alter street suffix", () => {
    const PatientDataMPI: PatientDataMPI = {
      id: "123456789",
      firstName: "John",
      lastName: "Dogo",
      dob: "1990-01-01",
      genderAtBirth: "M",
      address: [
        {
          addressLine1: "123 Elm Street",
          city: "New York",
          zip: "10001",
          state: USState.NY,
        },
      ],
      contact: [
        {
          email: "john.doe@example.com",
          phone: "123-456-7890",
        },
      ],
    };

    const expected: PatientDataMPI = {
      id: "123456789",
      firstName: "john",
      lastName: "dogo",
      dob: "1990-01-01",
      genderAtBirth: "M",
      address: [
        {
          addressLine1: "123 elm st",
          city: "new york",
          zip: "10001",
          state: USState.NY,
          country: "USA",
        },
      ],
      contact: [
        {
          email: "john.doe@example.com",
          phone: "1234567890",
        },
      ],
    };

    const result = normalizePatient(PatientDataMPI);
    expect(result).toEqual(expected);
  });

  it("should normalize first and last name to lowercase and remove apostrophes and hyphens", () => {
    const PatientDataMPI: PatientDataMPI = {
      id: "123456789",
      firstName: "John-O'Connor",
      lastName: "Doe-Smith",
      dob: "1990-01-01",
      genderAtBirth: "M",
      address: [
        {
          addressLine1: "123 elm St",
          city: "new york",
          zip: "10001",
          state: USState.NY,
        },
      ],
      contact: [
        {
          email: "john.doe@example.com",
          phone: "123-456-7890",
        },
      ],
    };

    const expected: PatientDataMPI = {
      id: "123456789",
      firstName: "johnoconnor",
      lastName: "doesmith",
      dob: "1990-01-01",
      genderAtBirth: "M",
      address: [
        {
          addressLine1: "123 elm st",
          city: "new york",
          zip: "10001",
          state: USState.NY,
          country: "USA",
        },
      ],
      contact: [
        {
          email: "john.doe@example.com",
          phone: "1234567890",
        },
      ],
    };

    const result = normalizePatient(PatientDataMPI);

    expect(result).toEqual(expected);
  });

  // Should normalize email addresses to lowercase and remove leading/trailing whitespaces
  it("should normalize email addresses to lowercase and remove leading/trailing whitespaces", () => {
    const PatientDataMPI: PatientDataMPI = {
      id: "123456789",
      firstName: "john   ",
      lastName: "dogo    ",
      dob: "1990-01-01",
      genderAtBirth: "M",
      address: [
        {
          addressLine1: "123 elm st    ",
          city: "   new york     ",
          zip: "10001",
          state: USState.NY,
        },
      ],
      contact: [
        {
          email: "  JOHN.DOE@example.com  ",
          phone: "1234567890",
        },
      ],
    };

    const expected: PatientDataMPI = {
      id: "123456789",
      firstName: "john",
      lastName: "dogo",
      dob: "1990-01-01",
      genderAtBirth: "M",
      address: [
        {
          addressLine1: "123 elm st",
          city: "new york",
          zip: "10001",
          state: USState.NY,
          country: "USA",
        },
      ],
      contact: [
        {
          email: "john.doe@example.com",
          phone: "1234567890",
        },
      ],
    };

    const result = normalizePatient(PatientDataMPI);

    expect(result).toEqual(expected);
  });
});
