import { BaseDomain } from "@metriport/core/domain/base-domain";
import { EhrSources } from "../external/ehr/shared";

export type PatientSources = EhrSources;

export interface PatientMapping extends BaseDomain {
  externalId: string;
  cxId: string;
  patientId: string;
  source: PatientSources;
}
