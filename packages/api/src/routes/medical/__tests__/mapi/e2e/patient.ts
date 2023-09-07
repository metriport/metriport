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
  patientToCompare?: PatientCreate | Patient
) => {
  expect(patient.id).toBeTruthy();

  if (patientToCompare) {
    expect(patient.firstName).toBe(patientToCompare.firstName);
    expect(patient.lastName).toBe(patientToCompare.lastName);
    expect(patient.dob).toBe(patientToCompare.dob);
    expect(patient.genderAtBirth).toBe(patientToCompare.genderAtBirth);
  } else {
    expect(patient.firstName).toBeTruthy();
    expect(patient.lastName).toBeTruthy();
    expect(patient.dob).toBeTruthy();
    expect(patient.genderAtBirth).toBeTruthy();
  }
};

export const validateFhirPatient = (
  patient: FhirPatient,
  patientToCompare?: PatientCreate | Patient
) => {
  expect(patient.resourceType).toBeTruthy();
  expect(patient.resourceType).toBe("Patient");
  expect(patient.id).toBeTruthy();
  expect(patient.name).toBeTruthy();
  expect(patient.name?.length).toBe(1);

  if (patientToCompare) {
    expect(patient.name?.[0].given).toBe(patientToCompare.firstName);
    expect(patient.name?.[0].family).toBe(patientToCompare.lastName);
    expect(patient.birthDate).toBe(patientToCompare.dob);
    expect(patient.gender).toBe(patientToCompare.genderAtBirth);
  } else {
    expect(patient.name?.[0].given).toBeTruthy();
    expect(patient.name?.[0].family).toBeTruthy();
    expect(patient.birthDate).toBeTruthy();
    expect(patient.gender).toBeTruthy();
  }
};
