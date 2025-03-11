import { BaseDomain } from "@metriport/core/domain/base-domain";
import { ehrSources } from "@metriport/shared/src/interface/external/shared/ehr/source";

export type PatientSourceIdentifierMap = {
  [key in string]: string[];
};

const patientMappingSource = [...ehrSources] as const;
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
