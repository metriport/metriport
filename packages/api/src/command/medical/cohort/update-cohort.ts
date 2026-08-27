import { out } from "@metriport/core/util";
import { BadRequestError } from "@metriport/shared";
import { mergeSettings } from "@metriport/shared/common/merge-settings";
import {
  Cohort,
  CohortUpdateCmd,
  CohortWithSize,
  normalizeCohortName,
} from "@metriport/shared/domain/cohort";
import { validateVersionForUpdate } from "../../../models/_default";
import { validateCohortSettingsOrFail } from "../../medical/patient/get-settings";
import { getCohortByName, getCohortModelOrFail } from "./get-cohort";
import { getCohortSize } from "./patient-cohort/get-cohort-size";

export async function updateCohort({
  id,
  eTag,
  cxId,
  ...data
}: CohortUpdateCmd): Promise<CohortWithSize> {
  const { log } = out(`updateCohort - cx: ${cxId}, id: ${id}`);
  const cohort = await getCohortModelOrFail({ cohortId: id, cxId });

  const updateData = await mergeAndValidateCohortOrFail({
    id,
    eTag,
    cxId,
    cohort,
    log,
    ...data,
  });

  const [updatedCohort, size] = await Promise.all([
    cohort.update(updateData),
    getCohortSize({ cohortId: id, cxId }),
  ]);

  log(`Done. Updated cohort: ${JSON.stringify(updatedCohort.dataValues)}`);
  return { ...updatedCohort.dataValues, eTag: updatedCohort.eTag, size };
}

type UpdateData = Partial<Pick<Cohort, "name" | "description" | "color" | "settings">>;
async function mergeAndValidateCohortOrFail({
  id,
  eTag,
  cxId,
  log,
  cohort,
  ...data
}: CohortUpdateCmd & { log: (msg: string) => void; cohort: Cohort }): Promise<UpdateData> {
  validateVersionForUpdate(cohort, eTag);

  const newName = data.name;
  const name =
    newName !== undefined
      ? await validateCohortName({ cxId, name: newName, cohortId: id })
      : cohort.name;

  const newSettings = data.settings;
  const mergedSettings = newSettings
    ? mergeSettings({ oldSettings: cohort.settings, newSettings })
    : cohort.settings;

  await validateCohortSettingsOrFail(cxId, mergedSettings, log);

  const newData: UpdateData = {
    ...data,
    name,
    settings: mergedSettings,
  };

  return newData;
}

export async function validateCohortName({
  cxId,
  name,
  cohortId,
}: {
  cxId: string;
  name: string;
  cohortId?: string;
}): Promise<string> {
  const normalizedName = normalizeCohortName(name);
  const existingCohort = await getCohortByName({ cxId, name: normalizedName });
  if (existingCohort && existingCohort.id !== cohortId) {
    throw new BadRequestError("A cohort with this name already exists", undefined, {
      existingCohortId: existingCohort.id,
      name: normalizedName,
    });
  }

  return normalizedName;
}
