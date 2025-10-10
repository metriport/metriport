import { PatientCohort } from "@metriport/shared/domain/patient-cohort";

export type PatientCohortDTO = {
  patientId: string;
  cohortId: string;
};

export function dtoFromPatientCohort(cohort: PatientCohort): PatientCohortDTO {
  return {
    patientId: cohort.patientId,
    cohortId: cohort.cohortId,
  };
}
