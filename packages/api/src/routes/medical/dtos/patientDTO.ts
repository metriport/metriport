import { Patient } from "../../../domain/medical/patient";
import { toBaseDTO } from "./baseDTO";
import { DemographicsDTO } from "./demographicsDTO";

export type PatientDTO = {
  facilityIds: string[];
  externalId?: string;
  dateCreated?: Date;
} & DemographicsDTO;

export function dtoFromModel(patient: Patient): PatientDTO {
  const { firstName, lastName, dob, genderAtBirth, personalIdentifiers, address, contact } =
    patient.data;
  return {
    ...toBaseDTO(patient),
    facilityIds: patient.facilityIds,
    externalId: patient.externalId,
    dateCreated: patient.createdAt,
    firstName,
    lastName,
    dob,
    genderAtBirth,
    personalIdentifiers,
    address,
    contact,
  };
}
