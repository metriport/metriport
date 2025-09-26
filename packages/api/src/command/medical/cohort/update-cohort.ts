import { CohortEntity, CohortUpdate } from "@metriport/shared/domain/cohort";
import { out } from "@metriport/core/util";
import { validateVersionForUpdate } from "../../../models/_default";
import { BaseUpdateCmdWithCustomer } from "../base-update-command";
import { getCohortModelOrFail } from "./get-cohort";

export type CohortUpdateCmd = BaseUpdateCmdWithCustomer & CohortUpdate;

export async function updateCohort({
  id,
  eTag,
  cxId,
  ...data
}: CohortUpdateCmd): Promise<CohortEntity> {
  const { log } = out(`updateCohort - cx: ${cxId}, id: ${id}`);

  const cohort = await getCohortModelOrFail({ id, cxId });
  validateVersionForUpdate(cohort, eTag);

  const updatedCohort = await cohort.update({
    ...data,
  });

  log(`Done. Updated cohort: ${JSON.stringify(updatedCohort.dataValues)}`);
  return updatedCohort.dataValues;
}
