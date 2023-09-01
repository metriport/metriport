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

//eslint-disable-next-line @typescript-eslint/no-explicit-any
export const validateLocalPatient = (patient: Patient, patientValidator: any) => {
  expect(patient.id).toBeTruthy();
  expect(patient.firstName).toBe(patientValidator.firstName);
  expect(patient.lastName).toBe(patientValidator.lastName);
  expect(patient.dob).toBe(patientValidator.dob);
  expect(patient.genderAtBirth).toBe(patientValidator.genderAtBirth);
};

//eslint-disable-next-line @typescript-eslint/no-explicit-any
export const validateFhirPatient = (patient: FhirPatient) => {
  expect(patient.resourceType).toBeTruthy();
  expect(patient.resourceType).toBe("Patient");
  expect(patient.id).toBeTruthy();
};

//eslint-disable-next-line @typescript-eslint/no-explicit-any
export const validateCWPatient = (patient: CWPatient | undefined, patientValidator: any) => {
  expect(patient?.active).toBeTruthy();
  expect(patient?.details.name).toBe(patientValidator.name);
  expect(patient?.details.gender).toBe(patientValidator.gender);
  expect(patient?._links).toBeTruthy();
};
