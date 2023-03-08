import { Patient, PatientData } from "../../../models/medical/patient";

export type PatientDTO = Pick<Patient, "id" | "facilityIds"> &
  Pick<
    PatientData,
    | "firstName"
    | "lastName"
    | "dob"
    | "genderAtBirth"
    | "personalIdentifiers"
    | "address"
    | "contact"
  >;

export function dtoFromModel(patient: Patient): PatientDTO {
  const { firstName, lastName, dob, genderAtBirth, personalIdentifiers, address, contact } =
    patient.data;
  return {
    id: patient.id,
    facilityIds: patient.facilityIds,
    firstName,
    lastName,
    dob,
    genderAtBirth,
    personalIdentifiers,
    address,
    contact,
  };
}
