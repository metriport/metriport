import { PatientMapping } from "@metriport/core/domain/patient-mapping";

export type PatientMappingDTO = PatientMapping;

export function dtoFromPatientMapping(mapping: PatientMapping): PatientMappingDTO {
  return mapping;
}
