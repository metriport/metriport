import { BaseDomain } from "@metriport/core/domain/base-domain";
import { EhrSources } from "../external/ehr/shared";

export type PatientSourceMap = Record<string, string>;

export type PatientMappingSource = EhrSources.athena | EhrSources.elation;
export function isPatientMappingSource(source: string): source is PatientMappingSource {
  return source === EhrSources.athena || source === EhrSources.elation;
}

export type PatientMappingPerSource = {
  externalId: string;
  cxId: string;
  patientId: string;
  source: PatientMappingSource;
};

export interface PatientMapping extends BaseDomain, PatientMappingPerSource {}
