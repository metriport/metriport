import { BaseDomain } from "@metriport/core/domain/base-domain";

export interface PatientMapping extends BaseDomain {
  externalId: string;
  cxId: string;
  patientId: string;
  source: string;
}
