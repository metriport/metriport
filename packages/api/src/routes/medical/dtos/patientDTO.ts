import { Patient, PatientExternalData } from "@metriport/core/domain/patient";
import { DocumentQueryProgress } from "@metriport/core/domain/document-query";
import { BaseDTO, toBaseDTO } from "./baseDTO";
import { DemographicsDTO } from "./demographicsDTO";
import { getPatientExternalIdsFromSources } from "../../../command/mapping/patient";
import { EhrSourcesList } from "../../../external/ehr/shared";

export type PatientDTO = {
  facilityIds: string[];
  externalId?: string;
  ehrIds?: Record<string, string>;
  dateCreated?: Date;
} & DemographicsDTO;

export type InternalPatientDTO = BaseDTO &
  PatientDTO & {
    externalData: PatientExternalData | undefined;
    documentQueryProgress: DocumentQueryProgress | undefined;
  };

// the getDomainFromDTO function is in core in patient-loader-metriport-api.ts
export async function dtoFromModel(patient: Patient): Promise<PatientDTO> {
  const { firstName, lastName, dob, genderAtBirth, personalIdentifiers, address, contact } =
    patient.data;
  const ehrIds = await getPatientExternalIdsFromSources({
    cxId: patient.cxId,
    patientId: patient.id,
    sources: EhrSourcesList,
  });
  return {
    ...toBaseDTO(patient),
    facilityIds: patient.facilityIds,
    externalId: patient.externalId,
    ...(ehrIds ? { ehrIds } : {}),
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

export async function internalDtoFromModel(patient: Patient): Promise<InternalPatientDTO> {
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
  const ehrIds = await getPatientExternalIdsFromSources({
    cxId: patient.cxId,
    patientId: patient.id,
    sources: EhrSourcesList,
  });
  return {
    ...toBaseDTO(patient),
    facilityIds: patient.facilityIds,
    externalId: patient.externalId,
    ...(ehrIds ? { ehrIds } : {}),
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
