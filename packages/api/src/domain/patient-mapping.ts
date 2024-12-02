import { BaseDomain } from "@metriport/core/domain/base-domain";
import { EhrSources } from "../external/ehr/shared";

export type PatientSources = PatientMappingPerSource["source"];

export type PatientMappingPerSource = {
  externalId: string;
  cxId: string;
  patientId: string;
} & {
  source: EhrSources.athena | EhrSources.elation;
};

export interface PatientMapping extends BaseDomain, PatientMappingPerSource {}
