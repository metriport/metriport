import { Patient, PatientExternalData } from "@metriport/core/domain/patient";
import { DocumentQueryProgress } from "@metriport/core/domain/document-query";
import { BaseDTO, toBaseDTO } from "./baseDTO";
import { DemographicsDTO } from "./demographicsDTO";

export type PatientDTO = {
  facilityIds: string[];
  externalId?: string;
  hieOptOut?: boolean;
  dateCreated?: Date;
} & DemographicsDTO;

export type InternalPatientDTO = BaseDTO &
  PatientDTO & {
    externalData: PatientExternalData | undefined;
    documentQueryProgress: DocumentQueryProgress | undefined;
  };

// the getDomainFromDTO function is in core in patient-loader-metriport-api.ts
export function dtoFromModel(patient: Patient): PatientDTO {
  const { firstName, lastName, dob, genderAtBirth, personalIdentifiers, address, contact } =
    patient.data;
  return {
    ...toBaseDTO(patient),
    facilityIds: patient.facilityIds,
    externalId: patient.externalId,
    dateCreated: patient.createdAt,
    hieOptOut: patient.hieOptOut,
    firstName,
    lastName,
    dob,
    genderAtBirth,
    personalIdentifiers,
    address,
    contact,
  };
}

export function internalDtoFromModel(patient: Patient): InternalPatientDTO {
  const {
    firstName,
    lastName,
    dob,
    genderAtBirth,
    personalIdentifiers,
    address,
    contact,
    externalData,
    documentQueryProgress,
  } = patient.data;
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
    externalData,
    documentQueryProgress,
  };
}
