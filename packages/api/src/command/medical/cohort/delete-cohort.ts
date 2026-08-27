import { out } from "@metriport/core/util";
import { CohortModel } from "../../../models/medical/cohort";
import { BadRequestError, NotFoundError } from "@metriport/shared";
import { getCohortSize } from "./patient-cohort/get-cohort-size";
import { GetCohortCmd } from "./get-cohort";

export type DeleteCohortCmd = GetCohortCmd;

export async function deleteCohort({ cohortId, cxId }: DeleteCohortCmd): Promise<void> {
  const { log } = out(`deleteCohort - cx: ${cxId}, cohortId: ${cohortId}`);

  const size = await getCohortSize({ cohortId, cxId });

  if (size > 0) {
    throw new BadRequestError("Cannot delete cohort with patients", undefined, {
      cohortId,
      size,
    });
  }

  const deletedCount = await CohortModel.destroy({ where: { id: cohortId, cxId } });

  if (deletedCount < 1) {
    throw new NotFoundError(`Could not find cohort for deletion`, undefined, { cohortId });
  }

  log(`Done.`);
}
