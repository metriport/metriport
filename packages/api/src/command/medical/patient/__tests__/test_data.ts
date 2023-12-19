import { PatientDataMPI } from "@metriport/core/src/external/mpi/patient-incoming-schema";
import { USState } from "@metriport/core/domain/geographic-locations";

export const testPatientDataMPI: {
  sampleSearch: PatientDataMPI[];
  sampleInclusions: PatientDataMPI[];
  sampleExclusions: PatientDataMPI[];
} = {
  sampleSearch: [
    {
      id: "123456789",
      firstName: "Juan",
      lastName: "Valdez",
      dob: "09/10/1947",
      genderAtBirth: "M",
      address: [
        {
          addressLine1: "123 Street",
          zip: "94110",
          country: "USA",
          state: USState.NY,
          city: "NYC",
        },
      ],
      contact: [
        {
          phone: "123-456-7890",
          email: "juan@gmail.com",
        },
      ],
      personalIdentifiers: [
        {
          type: "driversLicense",
          value: "123456789",
          state: USState.NY,
        },
      ],
    },
  ],
  sampleInclusions: [
    {
      id: "123456789",
      firstName: "Juan",
      lastName: "Valdez",
      dob: "09/10/1947",
      genderAtBirth: "M",
      address: [
        {
          addressLine1: "123 Street",
          zip: "94110",
          country: "USA",
          state: USState.NY,
          city: "NYC",
        },
      ],
      personalIdentifiers: [
        {
          type: "driversLicense",
          value: "123456789",
          state: USState.NY,
        },
      ],
    },
    {
      id: "123456789",
      firstName: "Juan",
      lastName: "Valdez",
      dob: "09/10/1947",
      genderAtBirth: "M",
      address: [
        {
          addressLine1: "123 Street",
          zip: "94136",
          country: "USA",
          state: USState.NY,
          city: "NYC",
        },
      ],
    },
    {
      id: "123456789",
      firstName: "Juan",
      lastName: "Valdez",
      dob: "10/09/1947",
      genderAtBirth: "M",
      address: [
        {
          addressLine1: "123 Street",
          zip: "94110",
          country: "USA",
          state: USState.NY,
          city: "NYC",
        },
      ],
    },
    {
      id: "123456789",
      firstName: "Juan",
      lastName: "Valdez",
      dob: "09/10/1947",
      genderAtBirth: "F",
      address: [
        {
          addressLine1: "123 Street",
          zip: "94110",
          country: "USA",
          state: USState.NY,
          city: "NYC",
        },
      ],
    },
    {
      id: "123456789",
      firstName: "Juan",
      lastName: "Valdes",
      dob: "09/10/1947",
      genderAtBirth: "M",
      address: [
        {
          addressLine1: "123 Street",
          zip: "94116",
          country: "USA",
          state: USState.NY,
          city: "NYC",
        },
      ],
    },
    {
      id: "123456789",
      firstName: "Juan",
      lastName: "Valdez",
      dob: "09/10/1946",
      genderAtBirth: "M",
      address: [
        {
          addressLine1: "123 Street",
          zip: "94136",
          country: "USA",
          state: USState.NY,
          city: "NYC",
        },
      ],
    },
  ],
  sampleExclusions: [
    {
      id: "123456789",
      firstName: "Juan",
      lastName: "Valdez",
      dob: "09/10/1947",
      genderAtBirth: "M",
      address: [
        {
          addressLine1: "123 Street",
          zip: "60290",
          country: "USA",
          state: USState.NY,
          city: "NYC",
        },
      ],
      contact: [
        {
          phone: "555-555-5555",
          email: "bill@bill.com",
        },
      ],
    },
    {
      id: "123456789",
      firstName: "John",
      lastName: "Valdez",
      dob: "09/10/1957",
      genderAtBirth: "M",
      address: [
        {
          addressLine1: "123 Street",
          zip: "94110",
          country: "USA",
          state: USState.NY,
          city: "NYC",
        },
      ],
    },
    {
      id: "123456789",
      firstName: "John",
      lastName: "Valdez",
      dob: "09/10/1947",
      genderAtBirth: "M",
      address: [
        {
          addressLine1: "123 Street",
          zip: "90031",
          country: "USA",
          state: USState.NY,
          city: "NYC",
        },
      ],
    },
    {
      id: "123456789",
      firstName: "Juan",
      lastName: "Smith",
      dob: "09/10/1947",
      genderAtBirth: "M",
      address: [
        {
          addressLine1: "123 Street",
          zip: "94136",
          country: "USA",
          state: USState.NY,
          city: "NYC",
        },
      ],
    },
    {
      id: "123456789",
      firstName: "Juan",
      lastName: "Smith",
      dob: "09/10/1947",
      genderAtBirth: "M",
      address: [
        {
          addressLine1: "123 Street",
          zip: "90031",
          country: "USA",
          state: USState.NY,
          city: "NYC",
        },
      ],
    },
    {
      id: "123456789",
      firstName: "John",
      lastName: "Valdez",
      dob: "09/10/1947",
      genderAtBirth: "M",
      address: [
        {
          addressLine1: "123 Street",
          zip: "94110",
          country: "USA",
          state: USState.NY,
          city: "NYC",
        },
      ],
    },
    {
      id: "123456789",
      firstName: "Juan",
      lastName: "Smith",
      dob: "09/10/1947",
      genderAtBirth: "M",
      address: [
        {
          addressLine1: "123 Street",
          zip: "94110",
          country: "USA",
          state: USState.NY,
          city: "NYC",
        },
      ],
    },
  ],
};
