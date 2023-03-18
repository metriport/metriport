import { patientExternalDataToLinks } from "../../../external/patient-external";
import { Patient, PatientData } from "../../../models/medical/patient";
import { BaseDTO, toBaseDTO } from "./baseDTO";
import { PatientLinksDTO } from "./linkDTO";

export type PatientDTO = BaseDTO &
  Pick<Patient, "id" | "facilityIds"> &
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
    ...toBaseDTO(patient),
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
