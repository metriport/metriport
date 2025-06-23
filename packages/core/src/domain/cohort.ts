import { BaseDomain, BaseDomainCreate } from "./base-domain";

export type MonitoringSettings = {
  adt?: boolean;
};

export interface CohortCreate extends BaseDomainCreate {
  cxId: string;
  name: string;
  monitoring?: MonitoringSettings;
}

export interface Cohort extends BaseDomain, CohortCreate {}

export interface PatientCohortData {
  patientId: string;
  cohortId: string;
}

export interface PatientCohortCreate extends PatientCohortData {
  cxId: string;
}

export interface PatientCohort extends BaseDomain, Required<PatientCohortData> {}
