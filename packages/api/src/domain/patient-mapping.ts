import { BaseDomain } from "@metriport/core/domain/base-domain";
import { EhrSources } from "../external/ehr/shared";

export type PatientSources = EhrSources.athena | EhrSources.elation;
export function isPatientMappingSource(source: string): source is PatientSources {
  return source === EhrSources.athena || source === EhrSources.elation;
}

export type PatientMappingPerSource = {
  externalId: string;
  cxId: string;
  patientId: string;
  source: PatientSources;
};

export interface PatientMapping extends BaseDomain, PatientMappingPerSource {}
