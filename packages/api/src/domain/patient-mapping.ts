import { BaseDomain } from "@metriport/core/domain/base-domain";

export type PatientMappingSource = PatientMappingParams["source"];

export type PatientMappingParams = {
  externalId: string;
  cxId: string;
  patientId: string;
  source: string;
};

export interface PatientMapping extends BaseDomain, PatientMappingParams {}
