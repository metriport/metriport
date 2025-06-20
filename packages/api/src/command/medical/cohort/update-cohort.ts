import { Cohort, CohortCreate } from "@metriport/core/domain/cohort";
import { out } from "@metriport/core/util";
import { BadRequestError } from "@metriport/shared";
import { validateVersionForUpdate } from "../../../models/_default";
import { BaseUpdateCmdWithCustomer } from "../base-update-command";
import { getCohortByName, getCohortModelOrFail } from "./get-cohort";

export type CohortUpdateCmd = BaseUpdateCmdWithCustomer & Partial<CohortCreate>;

export async function updateCohort({
  id,
  eTag,
  cxId,
  name,
  monitoring,
}: CohortUpdateCmd): Promise<Cohort> {
  const { log } = out(`updateCohort - cx: ${cxId}, id: ${id}`);

  const cohort = await getCohortModelOrFail({ id, cxId });
  validateVersionForUpdate(cohort, eTag);

  if (name !== undefined) {
    const trimmedName = name.trim();

    const existingCohort = await getCohortByName({ cxId, name: trimmedName });
    if (existingCohort) {
      throw new BadRequestError("A cohort with this name already exists", undefined, {
        cxId,
        name: trimmedName,
      });
    }

    name = trimmedName;
  }

  const updatedCohort = await cohort.update({
    name,
    monitoring,
  });

  log(`Done. Updated cohort: ${JSON.stringify(updatedCohort.dataValues)}`);
  return updatedCohort.dataValues;
}
