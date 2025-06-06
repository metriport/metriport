import { Cohort, CohortCreate } from "@metriport/core/domain/cohort";
import { out } from "@metriport/core/util";
import { validateVersionForUpdate } from "../../../models/_default";
import { BaseUpdateCmdWithCustomer } from "../base-update-command";
import { getCohortModelOrFail } from "./get-cohort";

export type CohortUpdateCmd = BaseUpdateCmdWithCustomer & Partial<CohortCreate>;

export async function updateCohort({
  id,
  eTag,
  cxId,
  name,
  monitoring,
  otherSettings,
}: CohortUpdateCmd): Promise<Cohort> {
  const { log } = out(`updateCohort - cx: ${cxId}, id: ${id}`);

  const cohort = await getCohortModelOrFail({ id, cxId });
  validateVersionForUpdate(cohort, eTag);

  const updatedCohort = await cohort.update({
    name,
    monitoring,
    otherSettings,
  });

  log(`Done. Updated cohort: ${JSON.stringify(updatedCohort.dataValues)}`);
  return updatedCohort.dataValues;
}
