import { out } from "@metriport/core/util";
import { Cohort, CohortUpdateCmd } from "@metriport/shared/domain/cohort";
import { validateVersionForUpdate } from "../../../models/_default";
import { CohortModel } from "../../../models/medical/cohort";
import { NotFoundError } from "@metriport/shared";

export async function updateCohort({ id, eTag, cxId, ...data }: CohortUpdateCmd): Promise<Cohort> {
  const { log } = out(`updateCohort - cx: ${cxId}, id: ${id}`);

  const cohort = await CohortModel.findOne({
    where: { id, cxId },
  });

  if (!cohort) throw new NotFoundError(`Could not find cohort`, undefined, { id, cxId });
  validateVersionForUpdate(cohort, eTag);

  const updatedCohort = await cohort.update(data);

  log(`Done. Updated cohort: ${JSON.stringify(updatedCohort.dataValues)}`);
  return updatedCohort.dataValues;
}
