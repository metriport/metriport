import { PatientWithIdentifiers } from "../../../command/medical/patient/get-patient";
import { PatientSourceIdentifierMap } from "../../../domain/patient-mapping";
import { toBaseDTO } from "./baseDTO";
import { DemographicsDTO } from "./demographicsDTO";

export type PatientDTO = {
  facilityIds: string[];
  externalId?: string;
  additionalIds?: PatientSourceIdentifierMap;
  dateCreated?: Date;
} & DemographicsDTO;

// the getDomainFromDTO function is in core in patient-loader-metriport-api.ts
export function dtoFromModel(patient: PatientWithIdentifiers): PatientDTO {
  const { firstName, lastName, dob, genderAtBirth, personalIdentifiers, address, contact } =
    patient.data;
  return {
    ...toBaseDTO(patient),
    facilityIds: patient.facilityIds,
    externalId: patient.externalId,
    additionalIds: patient.additionalIds,
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
