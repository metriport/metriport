import { BaseDomain } from "./base-domain";

export type PatientCohort = BaseDomain & {
  patientId: string;
  cohortId: string;
};
