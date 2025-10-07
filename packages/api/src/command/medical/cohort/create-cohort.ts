import { out } from "@metriport/core/util";
import { uuidv7 } from "@metriport/core/util/uuid-v7";
import { BadRequestError } from "@metriport/shared";
import { Cohort, CohortCreateCmd } from "@metriport/shared/domain/cohort";
import { CohortModel } from "../../../models/medical/cohort";
import { getCohortByNameSafe } from "./get-cohort";
import { normalizeCohortName } from "@metriport/core/command/patient-import/csv/convert-patient";

export async function createCohort({
  cxId,
  name,
  description,
  color,
  settings,
}: CohortCreateCmd): Promise<Cohort> {
  const { log } = out(`createCohort - cx: ${cxId}`);
  const normalizedName = normalizeCohortName(name);
  const existingCohort = await getCohortByNameSafe({ cxId, name: normalizedName });
  if (existingCohort) {
    throw new BadRequestError("A cohort with this name already exists", undefined, {
      cxId,
      name: normalizedName,
    });
  }

  const cohortCreate = {
    id: uuidv7(),
    cxId,
    name: normalizedName,
    description,
    color,
    settings,
  };

  const newCohort = await CohortModel.create(cohortCreate);

  log(`Done. New cohort ID: ${JSON.stringify(newCohort)}`);
  return newCohort.dataValues;
}
