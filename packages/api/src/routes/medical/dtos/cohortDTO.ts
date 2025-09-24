import { CohortColors, CohortEntity, CohortSettings } from "@metriport/core/domain/cohort";
import { toBaseDTO } from "./baseDTO";

export type CohortDTO = {
  id: string;
  cxId: string;
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

export function dtoFromCohort(cohort: CohortEntity & { eTag: string }): CohortDTO {
  return {
    ...toBaseDTO(cohort),
    name: cohort.name,
    cxId: cohort.cxId,
    color: cohort.color,
    settings: cohort.settings,
    description: cohort.description,
  };
}
