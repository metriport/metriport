import { Cohort, CohortColors, CohortSettings } from "@metriport/shared/domain/cohort";
import { toBaseDTO } from "./baseDTO";

export type CohortDTO = {
  id: string;
  name: string;
  description: string;
  color: CohortColors;
  settings: CohortSettings;
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
