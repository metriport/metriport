import { out } from "@metriport/core/util";
import { uuidv7 } from "@metriport/core/util/uuid-v7";
import {
  Cohort,
  CohortCreateCmd,
  DEFAULT_COLOR,
  DEFAULT_SETTINGS,
} from "@metriport/shared/domain/cohort";
import { cloneDeep } from "lodash";
import { CohortModel } from "../../../models/medical/cohort";
import { validateCohortSettingsOrFail } from "../patient/get-settings";
import { validateCohortName } from "./update-cohort";

/**
 * Creates a new cohort.
 * @param cxId - The ID of the CX.
 * @param name - The name of the cohort.
 * @param description - The description of the cohort.
 * @param color - The color of the cohort.
 * @param settings - The settings of the cohort.
 * @returns The created cohort.
 */
export async function createCohort({
  cxId,
  name,
  description = "",
  color = DEFAULT_COLOR,
  settings,
}: CohortCreateCmd): Promise<Cohort> {
  const { log } = out(`createCohort - cx: ${cxId}`);
  const normalizedName = await validateCohortName({ cxId, name });

  await validateCohortSettingsOrFail(cxId, settings, log);

  const cohortCreate = {
    id: uuidv7(),
    cxId,
    name: normalizedName,
    description,
    color,
    settings: settings ?? cloneDeep(DEFAULT_SETTINGS),
  };

  const newCohort = await CohortModel.create(cohortCreate);
  return { ...newCohort.dataValues, eTag: newCohort.eTag };
}
