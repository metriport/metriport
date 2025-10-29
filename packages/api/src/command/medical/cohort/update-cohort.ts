import { out } from "@metriport/core/util";
import { BadRequestError } from "@metriport/shared";
import {
  AllOptionalFullCohortSettings,
  FullCohortSettings,
  CohortWithSize,
  FullCohortUpdateCmd,
  normalizeCohortName,
} from "@metriport/shared/domain/cohort";
import { validateVersionForUpdate } from "../../../models/_default";
import { applyCohortOverrides, mergeOldWithNewCohortSettings } from "../../medical/patient/get-settings";
import { getCohortByNameSafe, getCohortModelOrFail } from "./get-cohort";
import { getCohortSize } from "./patient-cohort/get-cohort-size";
import { validateMonitoringSettingsForCx } from "./utils";

export async function updateCohort({
  id,
  eTag,
  cxId,
  ...data
}: FullCohortUpdateCmd): Promise<CohortWithSize> {
  const { log } = out(`updateCohort - cx: ${cxId}, id: ${id}`);
  const oldCohort = await getCohortModelOrFail({
    id,
    cxId,
  });
  validateVersionForUpdate(oldCohort, eTag);

  const name = await validateCohortName({
    cxId,
    cohortId: id,
    oldName: oldCohort.name,
    newName: data.name,
  });

  const newSettings = data.settings;
  const mergedSettings = newSettings
    ? await getMergedSettings({ cxId, oldSettings: oldCohort.settings, newSettings, log })
    : oldCohort.settings;
  const fullSettings = applyCohortOverrides(mergedSettings);

  const newData = {
    ...data,
    name: name,
    settings: fullSettings,
  };

  const [updatedCohort, size] = await Promise.all([
    oldCohort.update(newData),
    getCohortSize({ cohortId: id }),
  ]);

  log(`Done. Updated cohort: ${JSON.stringify(updatedCohort.dataValues)}`);
  return { ...updatedCohort.dataValues, size };
}

async function getMergedSettings({
  cxId,
  oldSettings,
  newSettings,
  log,
}: {
  cxId: string;
  oldSettings: FullCohortSettings;
  newSettings: AllOptionalFullCohortSettings;
  log: typeof console.log;
}): Promise<FullCohortSettings> {
  if (newSettings) {
    await validateMonitoringSettingsForCx(cxId, newSettings.monitoring, log);
  }
  return mergeOldWithNewCohortSettings(oldSettings, newSettings);
}

async function validateCohortName({
  cxId,
  cohortId,
  oldName,
  newName,
}: {
  cxId: string;
  cohortId: string;
  oldName: string;
  newName?: string;
}): Promise<string> {
  const normalizedName = newName ? normalizeCohortName(newName) : oldName;
  if (newName) {
    const existingCohort = await getCohortByNameSafe({ cxId, name: normalizedName });
    if (existingCohort && existingCohort.id !== cohortId) {
      throw new BadRequestError("A cohort with this name already exists", undefined, {
        existingCohortId: existingCohort.id,
        name: newName,
      });
    }
  }
  return normalizedName;
}
