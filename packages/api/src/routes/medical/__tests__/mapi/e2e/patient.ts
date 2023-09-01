import { USState, Patient, PatientCreate } from "@metriport/api-sdk";
import { Patient as CWPatient } from "@metriport/commonwell-sdk";
import { Patient as FhirPatient } from "@medplum/fhirtypes";
import { faker } from "@faker-js/faker";

export const createPatient: PatientCreate = {
  firstName: "John",
  lastName: "Smith",
  dob: "2000-01-01",
  genderAtBirth: "M",
  contact: {
    phone: faker.phone.number(),
    email: faker.internet.email(),
  },
  address: {
    addressLine1: "123 test ave",
    city: "Miami",
    state: USState.FL,
    zip: "12345",
    country: "USA",
  },
};

export const validateLocalPatient = (patient: Patient) => {
  expect(patient.id).toBeTruthy();
  expect(patient.firstName).toBeTruthy();
  expect(patient.lastName).toBeTruthy();
  expect(patient.dob).toBeTruthy();
  expect(patient.genderAtBirth).toBeTruthy();
  expect(patient.contact).toBeTruthy();
};

export const validateFhirPatient = (patient: FhirPatient) => {
  expect(patient.resourceType).toBeTruthy();
  expect(patient.resourceType).toBe("Patient");
  expect(patient.id).toBeTruthy();
  expect(patient.name).toBeTruthy();
  expect(patient.name?.length).toBe(1);
  expect(patient.name?.[0].given).toBeTruthy();
  expect(patient.name?.[0].family).toBeTruthy();
  expect(patient.birthDate).toBeTruthy();
  expect(patient.gender).toBeTruthy();
};

export const validateCWPatient = (patient: CWPatient | undefined) => {
  expect(patient?.active).toBeTruthy();
  expect(patient?.details.name).toBeTruthy();
  expect(patient?.details.name?.length).toBe(1);
  expect(patient?.details.name?.[0].given).toBeTruthy();
  expect(patient?.details.name?.[0].family).toBeTruthy();
  expect(patient?.details.birthDate).toBeTruthy();
  expect(patient?.details.gender).toBeTruthy();
  expect(patient?._links).toBeTruthy();
};
