import { Cohort } from "@metriport/core/domain/cohort";
import { toBaseDTO } from "./baseDTO";

export type CohortDTO = {
  id: string;
  cxId: string;
  name: string;
  monitoring?: {
    adt?: boolean;
  };
  otherSettings?: Record<string, unknown>;
  dateCreated?: Date;
};

export function dtoFromModel(cohort: Cohort): CohortDTO {
  return {
    ...toBaseDTO(cohort),
    name: cohort.name,
    cxId: cohort.cxId,
    monitoring: cohort.monitoring,
    dateCreated: cohort.createdAt,
  };
}
