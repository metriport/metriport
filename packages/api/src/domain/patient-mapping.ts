import { BaseDomain } from "@metriport/core/domain/base-domain";
import { EhrSources } from "../external/ehr/shared";

export type PatientMappingSource = EhrSources.athena | EhrSources.elation | EhrSources.canvas;
export function isPatientMappingSource(source: string): source is PatientMappingSource {
  return (
    source === EhrSources.athena || source === EhrSources.elation || source === EhrSources.canvas
  );
}

export type PatientMappingPerSource = {
  externalId: string;
  cxId: string;
  patientId: string;
  source: PatientMappingSource;
};

export interface PatientMapping extends BaseDomain, PatientMappingPerSource {}
