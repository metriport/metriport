import { out } from "@metriport/core/util";
import { CohortWithSize, CohortUpdateCmd } from "@metriport/shared/domain/cohort";
import { validateVersionForUpdate } from "../../../models/_default";
import { CohortModel } from "../../../models/medical/cohort";
import { NotFoundError } from "@metriport/shared";
import { getCohortSize } from "./patient-cohort/get-cohort-size";

export async function updateCohort({
  id,
  eTag,
  cxId,
  ...data
}: CohortUpdateCmd): Promise<CohortWithSize> {
  const { log } = out(`updateCohort - cx: ${cxId}, id: ${id}`);

  const cohort = await CohortModel.findOne({
    where: { id, cxId },
  });

  if (!cohort) throw new NotFoundError(`Could not find cohort`, undefined, { id, cxId });
  validateVersionForUpdate(cohort, eTag);

  const [updatedCohort, size] = await Promise.all([
    cohort.update(data),
    getCohortSize({ cohortId: id, cxId }),
  ]);

  log(`Done. Updated cohort: ${JSON.stringify(updatedCohort.dataValues)}`);
  return { cohort: updatedCohort.dataValues, size };
}
