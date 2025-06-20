import { Cohort } from "@metriport/core/domain/cohort";
import { toBaseDTO } from "./baseDTO";

export type CohortDTO = {
  id: string;
  cxId: string;
  name: string;
  monitoring?: {
    adt?: boolean;
  };
  dateCreated?: Date;
};

export type CohortWithCountDTO = {
  cohort: CohortDTO;
  patientCount: number;
};

export type CohortWithPatientIdsAndCountDTO = CohortWithCountDTO & {
  patientIds: string[];
};

export function dtoFromCohort(cohort: Cohort): CohortDTO {
  return {
    ...toBaseDTO(cohort),
    name: cohort.name,
    cxId: cohort.cxId,
    monitoring: cohort.monitoring,
    dateCreated: cohort.createdAt,
  };
}
