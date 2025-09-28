import { Cohort, CohortColors, CohortSettings } from "@metriport/shared/domain/cohort";
import { toBaseDTO } from "./baseDTO";

export type BaseDTO = {
  id: string;
  eTag: string;
};

export function toBaseDTO(model: { id: string; eTag: string }): BaseDTO {
  return {
    id: model.id,
    eTag: model.eTag,
  };
}

export type CohortDTO = {
  id: string;
  name: string;
  description: string;
  color: CohortColors;
  settings: CohortSettings;
};

export type CohortEntityWithSizeDTO = {
  cohort: CohortDTO;
  size: number;
};

export type CohortEntityWithPatientIdsAndSizeDTO = CohortEntityWithSizeDTO & {
  patientIds: string[];
};

export function dtoFromCohort(cohort: Cohort & { eTag: string }): CohortDTO {
  return {
    ...toBaseDTO(cohort),
    name: cohort.name,
    color: cohort.color,
    settings: cohort.settings,
    description: cohort.description,
  };
}
