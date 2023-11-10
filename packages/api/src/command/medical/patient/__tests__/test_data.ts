import { PatientData } from "../../../../domain/medical/patient";
import { USState } from "@metriport/api-sdk";

export const testPatientData: {
  sampleSearch: PatientData[];
  sampleInclusions: PatientData[];
  sampleExclusions: PatientData[];
} = {
  sampleSearch: [
    {
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
    },
  ],
  sampleInclusions: [
    {
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
    },
    {
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
    },
    {
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
