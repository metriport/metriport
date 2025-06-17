import { Cohort, CohortCreate } from "@metriport/core/domain/cohort";
import { out } from "@metriport/core/util";
import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { BadRequestError } from "@metriport/shared";
import { CohortModel } from "../../../models/medical/cohort";

export async function createCohort({
  cxId,
  name,
  monitoring,
}: Omit<CohortCreate, "id">): Promise<Cohort> {
  const { log } = out(`createCohort - cx: ${cxId}`);

  const existingCohort = await CohortModel.findOne({
    where: { cxId, name },
  });
  if (existingCohort) {
    throw new BadRequestError(`A cohort with the name ${name} already exists`);
  }

  const cohortCreate: CohortCreate = {
    id: uuidv7(),
    cxId,
    name,
    monitoring,
  };

  const newCohort = await CohortModel.create(cohortCreate);

  log(`Done. New cohort ID: ${JSON.stringify(newCohort)}`);
  return newCohort.dataValues;
}
