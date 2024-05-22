import { USState, PatientCreate, PatientDTO } from "@metriport/api-sdk";
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
  patient: PatientDTO,
  patientToCompare?: PatientCreate | PatientDTO
) => {
  expect(patient.id).toBeTruthy();

  if (patientToCompare) {
    expect(patient.firstName).toEqual(patientToCompare.firstName);
    expect(patient.lastName).toEqual(patientToCompare.lastName);
    expect(patient.dob).toEqual(patientToCompare.dob);
    expect(patient.genderAtBirth).toEqual(patientToCompare.genderAtBirth);
  } else {
    expect(patient.firstName).toBeTruthy();
    expect(patient.lastName).toBeTruthy();
    expect(patient.dob).toBeTruthy();
    expect(patient.genderAtBirth).toBeTruthy();
  }
};

export const validateFhirPatient = (
  patient: FhirPatient,
  patientToCompare?: PatientCreate | PatientDTO
) => {
  expect(patient.resourceType).toBeTruthy();
  expect(patient.resourceType).toEqual("Patient");
  expect(patient.id).toBeTruthy();
  expect(patient.name).toBeTruthy();
  expect(patient.name?.length).toEqual(1);

  if (patientToCompare) {
    expect(patient.name?.[0].given?.[0]).toEqual(patientToCompare.firstName);
    expect(patient.name?.[0].family).toEqual(patientToCompare.lastName);
    expect(patient.birthDate).toEqual(patientToCompare.dob);
  } else {
    expect(patient.name?.[0].given).toBeTruthy();
    expect(patient.name?.[0].family).toBeTruthy();
    expect(patient.birthDate).toBeTruthy();
    expect(patient.gender).toBeTruthy();
  }
};
