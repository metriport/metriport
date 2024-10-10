import { USStateWithoutTerritories, USState } from "@metriport/shared";
import { PatientMPI } from "../shared";

export const testPatientMPI: {
  sampleSearch: PatientMPI[];
  sampleInclusions: PatientMPI[];
  sampleExclusions: PatientMPI[];
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
          state: USStateWithoutTerritories.NY,
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
          zip: "94110",
          country: "USA",
          state: USState.NY,
          city: "NYC",
        },
      ],
      contact: [
        {
          phone: "123-456-7890",
        },
      ],
      personalIdentifiers: [
        {
          type: "driversLicense",
          value: "123456789",
          state: USStateWithoutTerritories.NY,
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
          zip: "94110",
          country: "USA",
          state: USState.NY,
          city: "NYC",
        },
      ],
      contact: [
        {
          email: "juan@gmail.com",
        },
      ],
      personalIdentifiers: [
        {
          type: "driversLicense",
          value: "123456789",
          state: USStateWithoutTerritories.NY,
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
          state: USStateWithoutTerritories.NY,
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
          zip: "60290",
          country: "USA",
          state: USState.NY,
          city: "NYC",
        },
      ],
      contact: [
        {
          email: "bill@bill.com",
        },
      ],
    },
  ],
};
