import { DocumentQueryProgress } from "@metriport/core/domain/document-query";
import { PatientExternalData } from "@metriport/core/domain/patient";
import { PatientWithExternalIds } from "../../../command/medical/patient/get-patient";
import { PatientSourceMap } from "../../../domain/patient-mapping";
import { BaseDTO, toBaseDTO } from "./baseDTO";
import { DemographicsDTO } from "./demographicsDTO";

export type PatientDTO = {
  facilityIds: string[];
  externalId?: string;
  ehrIds?: PatientSourceMap;
  dateCreated?: Date;
} & DemographicsDTO;

export type InternalPatientDTO = BaseDTO &
  PatientDTO & {
    externalData: PatientExternalData | undefined;
    documentQueryProgress: DocumentQueryProgress | undefined;
  };

// the getDomainFromDTO function is in core in patient-loader-metriport-api.ts
export function dtoFromModel(patient: PatientWithExternalIds): PatientDTO {
  const { firstName, lastName, dob, genderAtBirth, personalIdentifiers, address, contact } =
    patient.data;
  return {
    ...toBaseDTO(patient),
    facilityIds: patient.facilityIds,
    externalId: patient.externalId,
    ehrIds: patient.ehrIds,
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

export function internalDtoFromModel(patient: PatientWithExternalIds): InternalPatientDTO {
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
    ehrIds: patient.ehrIds,
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
