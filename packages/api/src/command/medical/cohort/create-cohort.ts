import { CohortCreate, CohortEntity, CohortModelCreate } from "@metriport/core/domain/cohort";
import { out } from "@metriport/core/util";
import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { BadRequestError } from "@metriport/shared";
import { CohortModel } from "../../../models/medical/cohort";
import { getCohortByName } from "./get-cohort";

export async function createCohort({
  cxId,
  name,
  description,
  color,
  settings,
}: CohortCreate & { cxId: string }): Promise<CohortEntity> {
  const { log } = out(`createCohort - cx: ${cxId}`);

  const existingCohort = await getCohortByName({ cxId, name });
  if (existingCohort) {
    throw new BadRequestError("A cohort with this name already exists", undefined, {
      cxId,
      name,
    });
  }

  const cohortCreate: CohortModelCreate = {
    id: uuidv7(),
    cxId,
    name,
    description,
    color,
    settings,
  };

  const newCohort = await CohortModel.create(cohortCreate);

  log(`Done. New cohort ID: ${JSON.stringify(newCohort)}`);
  return newCohort.dataValues;
}
