import { BaseDomain, BaseDomainCreate } from "./base-domain";

export type MonitoringSettings = {
  adt: boolean;
};

export interface CohortCreate extends Omit<BaseDomainCreate, "id"> {
  cxId: string;
  name: string;
  monitoring: MonitoringSettings;
  otherSettings: Record<string, unknown>;
}

export interface Cohort extends BaseDomain, Required<CohortCreate> {}

export interface CohortAssignmentCreate extends Omit<BaseDomainCreate, "id"> {
  patientId: string;
  cohortId: string;
}

export interface CohortAssignment extends BaseDomain, Required<CohortAssignmentCreate> {}
