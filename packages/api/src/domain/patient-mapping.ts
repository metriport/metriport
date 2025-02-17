import { BaseDomain } from "@metriport/core/domain/base-domain";
import { EhrSources } from "../external/ehr/shared";

const patientMappingSource = [EhrSources.athena, EhrSources.elation, EhrSources.canvas] as const;
export type PatientMappingSource = (typeof patientMappingSource)[number];
export function isPatientMappingSource(source: string): source is PatientMappingSource {
  return patientMappingSource.includes(source as PatientMappingSource);
}

export type PatientMappingPerSource = {
  externalId: string;
  cxId: string;
  patientId: string;
  source: PatientMappingSource;
};

export interface PatientMapping extends BaseDomain, PatientMappingPerSource {}
