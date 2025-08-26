import { PatientMapping } from "@metriport/core/domain/patient-mapping";

export type PatientMappingDTO = Pick<
  PatientMapping,
  "patientId" | "cxId" | "externalId" | "source"
>;

export function dtoFromModel(mapping: PatientMapping): PatientMappingDTO {
  return {
    patientId: mapping.patientId,
    cxId: mapping.cxId,
    externalId: mapping.externalId,
    source: mapping.source,
  };
}
