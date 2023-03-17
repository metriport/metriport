import { patientExternalDataToLinks } from "../../../external/patient-external";
import { Patient, PatientData } from "../../../models/medical/patient";
import { PatientLinksDTO } from "./linkDTO";

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
  > & {
    links: PatientLinksDTO;
  };

export function dtoFromModel(patient: Patient): PatientDTO {
  const {
    firstName,
    lastName,
    dob,
    genderAtBirth,
    personalIdentifiers,
    address,
    contact,
    externalData,
  } = patient.data;
  const links = patientExternalDataToLinks(externalData);
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
    links,
  };
}
