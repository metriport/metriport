import { USState, Patient, PatientCreate } from "@metriport/api-sdk";
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

export const validateLocalPatient = (
  patient: Patient,
  validatePatient?: PatientCreate | Patient
) => {
  expect(patient.id).toBeTruthy();

  if (validatePatient) {
    expect(patient.firstName).toBe(validatePatient.firstName);
    expect(patient.lastName).toBe(validatePatient.lastName);
    expect(patient.dob).toBe(validatePatient.dob);
    expect(patient.genderAtBirth).toBe(validatePatient.genderAtBirth);
  } else {
    expect(patient.firstName).toBeTruthy();
    expect(patient.lastName).toBeTruthy();
    expect(patient.dob).toBeTruthy();
    expect(patient.genderAtBirth).toBeTruthy();
  }
};

export const validateFhirPatient = (
  patient: FhirPatient,
  validatePatient?: PatientCreate | Patient
) => {
  expect(patient.resourceType).toBeTruthy();
  expect(patient.resourceType).toBe("Patient");
  expect(patient.id).toBeTruthy();
  expect(patient.name).toBeTruthy();
  expect(patient.name?.length).toBe(1);

  if (validatePatient) {
    expect(patient.name?.[0].given).toBe(validatePatient.firstName);
    expect(patient.name?.[0].family).toBe(validatePatient.lastName);
    expect(patient.birthDate).toBe(validatePatient.dob);
    expect(patient.gender).toBe(validatePatient.genderAtBirth);
  } else {
    expect(patient.name?.[0].given).toBeTruthy();
    expect(patient.name?.[0].family).toBeTruthy();
    expect(patient.birthDate).toBeTruthy();
    expect(patient.gender).toBeTruthy();
  }
};
