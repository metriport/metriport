import { faker } from "@faker-js/faker";
import { Address, Patient as FhirPatient } from "@medplum/fhirtypes";
import { PatientCreate, PatientDTO, USState } from "@metriport/api-sdk";
import { Patient } from "@metriport/core/domain/patient";
import { mapGenderAtBirthToFhir } from "@metriport/core/external/fhir/patient/index";
import { PatientWithId } from "@metriport/core/external/fhir/__tests__/patient";

export const createPatient: PatientCreate = {
  firstName: "Junhdjjdkksuyujebeb",
  lastName: "Xamuscaeyttyworo",
  dob: "1900-01-01",
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
    expect(pat.dob).toEqual(patientToCompare.dob);
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

export function patientDtoToFhir(dto: PatientDTO): PatientWithId {
  const address = Array.isArray(dto.address) ? dto.address : [dto.address];
  return {
    resourceType: "Patient",
    id: dto.id,
    name: [
      {
        use: "official",
        family: dto.lastName,
        given: [dto.firstName],
      },
    ],
    birthDate: dto.dob,
    gender: mapGenderAtBirthToFhir(dto.genderAtBirth),
    address: address.flatMap(patientAddressDtoToFhir),
  };
}

export function patientAddressDtoToFhir(address: PatientDTO["address"]): Address[] {
  const addresses = Array.isArray(address) ? address : [address];
  return addresses.map(addr => {
    return {
      line: [addr.addressLine1, addr.addressLine2].flatMap(x => x ?? []),
      city: addr.city,
      state: addr.state,
      postalCode: addr.zip,
      country: addr.country,
    };
  });
}
