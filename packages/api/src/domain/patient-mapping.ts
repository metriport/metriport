import { BaseDomain } from "@metriport/core/domain/base-domain";
import { ehrSources } from "@metriport/shared/interface/external/ehr/source";
import { questSource } from "@metriport/shared/interface/external/quest/source";
import { surescriptsSource } from "@metriport/shared/interface/external/surescripts/source";

export type PatientSourceIdentifierMap = {
  [key in string]: string[];
};

const patientMappingSource = [...ehrSources, questSource, surescriptsSource] as const;
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
