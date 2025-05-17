import { DocumentQueryProgress } from "@metriport/core/domain/document-query";
import { PatientExternalData } from "@metriport/core/domain/patient";
import { PatientWithIdentifiers } from "../../../command/medical/patient/get-patient";
import { PatientSourceIdentifierMap } from "../../../domain/patient-mapping";
import { BaseDTO, toBaseDTO } from "./baseDTO";
import { DemographicsDTO } from "./demographicsDTO";

export type PatientDTO = {
  facilityIds: string[];
  externalId?: string;
  additionalIds?: PatientSourceIdentifierMap;
  dateCreated?: Date;
  hieOptOut?: boolean;
} & DemographicsDTO;

export type InternalPatientDTO = BaseDTO &
  PatientDTO & {
    externalData: PatientExternalData | undefined;
    documentQueryProgress: DocumentQueryProgress | undefined;
  };

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

export function internalDtoFromModel(patient: PatientWithIdentifiers): InternalPatientDTO {
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
    additionalIds: patient.additionalIds,
    dateCreated: patient.createdAt,
    hieOptOut: patient.hieOptOut,
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
