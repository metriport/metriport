import { PatientMapping } from "@metriport/core/domain/patient-mapping";

export type PatientMappingDTO = PatientMapping;

export function dtoFromModel(mapping: PatientMapping): PatientMappingDTO {
  return {
    patientId: mapping.patientId,
    cxId: mapping.cxId,
    externalId: mapping.externalId,
    source: mapping.source,
  };
}
