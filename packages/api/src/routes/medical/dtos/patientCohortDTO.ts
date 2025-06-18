import { PatientCohort } from "@metriport/core/domain/cohort";
import { toBaseDTO } from "./baseDTO";

export type PatientCohortDTO = {
  id: string;
  patientId: string;
  cohortId: string;
};

export function dtoFromModel(cohort: PatientCohort): PatientCohortDTO {
  return {
    ...toBaseDTO(cohort),
    patientId: cohort.patientId,
    cohortId: cohort.cohortId,
  };
}
