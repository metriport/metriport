import { faker } from "@faker-js/faker";
import { Patient as FhirPatient } from "@medplum/fhirtypes";
import { PatientCreate, PatientDTO, USState } from "@metriport/api-sdk";
import { Patient } from "@metriport/core/domain/patient";

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
  patient: PatientDTO | Patient,
  patientToCompare?: PatientCreate | PatientDTO
) => {
  const pat = "data" in patient ? { ...patient, ...patient.data } : patient;
  expect(pat.id).toBeTruthy();

  if (patientToCompare) {
    expect(pat.firstName).toEqual(patientToCompare.firstName);
    expect(pat.lastName).toEqual(patientToCompare.lastName);
    expect(pat.dob).toEqual(patientToCompare.dob + "dummy");
    expect(pat.genderAtBirth).toEqual(patientToCompare.genderAtBirth);
  } else {
    expect(pat.firstName).toBeTruthy();
    expect(pat.lastName).toBeTruthy();
    expect(pat.dob).toBeTruthy();
    expect(pat.genderAtBirth).toBeTruthy();
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
