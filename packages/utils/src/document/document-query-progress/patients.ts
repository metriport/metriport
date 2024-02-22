import { PatientCreate, USState } from "@metriport/api-sdk";

/**
 * List of patients to run doc queries for.
 */
export const patientsToCreate: PatientCreate[] = [
  {
    firstName: "Bruce",
    lastName: "Wayne",
    dob: "1939-01-01",
    genderAtBirth: "M",
    address: {
      addressLine1: "123 Test Ave",
      city: "Gotham",
      state: USState.NY,
      zip: "12345",
      country: "USA",
    },
  },
  {
    firstName: "Clark",
    lastName: "Kent",
    dob: "1938-01-01",
    genderAtBirth: "M",
    address: {
      addressLine1: "123 Test Ave",
      city: "Metropolis",
      state: USState.NY,
      zip: "12345",
      country: "USA",
    },
  },
  {
    firstName: "Diana",
    lastName: "Prince",
    dob: "1941-01-01",
    genderAtBirth: "F",
    address: {
      addressLine1: "123 Test Ave",
      city: "Themyscira",
      state: USState.NY,
      zip: "12345",
      country: "USA",
    },
  },
  {
    firstName: "Barry",
    lastName: "Allen",
    dob: "1956-01-01",
    genderAtBirth: "M",
    address: {
      addressLine1: "123 Test Ave",
      city: "Central City",
      state: USState.NY,
      zip: "12345",
      country: "USA",
    },
  },
  {
    firstName: "Arthur",
    lastName: "Curry",
    dob: "1941-01-01",
    genderAtBirth: "M",
    address: {
      addressLine1: "123 Test Ave",
      city: "Atlantis",
      state: USState.NY,
      zip: "12345",
      country: "USA",
    },
  },
  {
    firstName: "Tony",
    lastName: "Stark",
    dob: "1963-01-01",
    genderAtBirth: "M",
    address: {
      addressLine1: "123 Test Ave",
      city: "New York",
      state: USState.NY,
      zip: "12345",
      country: "USA",
    },
  },
  {
    firstName: "Steve",
    lastName: "Rogers",
    dob: "1941-01-01",
    genderAtBirth: "M",
    address: {
      addressLine1: "123 Test Ave",
      city: "Brooklyn",
      state: USState.NY,
      zip: "12345",
      country: "USA",
    },
  },
  {
    firstName: "Natasha",
    lastName: "Romanoff",
    dob: "1964-01-01",
    genderAtBirth: "F",
    address: {
      addressLine1: "123 Test Ave",
      city: "Stalingrad",
      state: USState.NY,
      zip: "12345",
      country: "USA",
    },
  },
  {
    firstName: "Wanda",
    lastName: "Maximoff",
    dob: "1964-01-01",
    genderAtBirth: "F",
    address: {
      addressLine1: "123 Test Ave",
      city: "Sokovia",
      state: USState.NY,
      zip: "12345",
      country: "USA",
    },
  },
];
