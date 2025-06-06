import { BaseDomain, BaseDomainCreate, BaseDomainNoId } from "./base-domain";

export type MonitoringSettings = {
  adt?: boolean;
};

export interface CohortCreate extends BaseDomainCreate {
  cxId: string;
  name: string;
  monitoring?: MonitoringSettings;
  otherSettings?: Record<string, unknown>;
}

export interface Cohort extends BaseDomain, CohortCreate {}

export interface CohortAssignmentData {
  patientId: string;
  cohortId: string;
}

export interface CohortAssignmentCreate extends CohortAssignmentData {
  cxId: string;
}

export interface CohortAssignment extends BaseDomainNoId, Required<CohortAssignmentData> {}
