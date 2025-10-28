import { out } from "@metriport/core/util";
import { BadRequestError, NotFoundError } from "@metriport/shared";
import {
  AllOptionalCohortSettings,
  CohortSettings,
  CohortUpdateCmd,
  CohortWithSize,
  normalizeCohortName,
} from "@metriport/shared/domain/cohort";
import { validateVersionForUpdate } from "../../../models/_default";
import { CohortModel } from "../../../models/medical/cohort";
import { mergeOldWithNewCohortSettings } from "../../medical/patient/get-settings";
import { getCohortByNameSafe } from "./get-cohort";
import { getCohortSize } from "./patient-cohort/get-cohort-size";
import { validateMonitoringSettingsForCx } from "./utils";

export async function updateCohort({
  id,
  eTag,
  cxId,
  ...data
}: CohortUpdateCmd): Promise<CohortWithSize> {
  const { log } = out(`updateCohort - cx: ${cxId}, id: ${id}`);

  const oldCohort = await CohortModel.findOne({
    where: { id, cxId },
  });
  if (!oldCohort) throw new NotFoundError(`Could not find cohort`, undefined, { cohortId: id });
  validateVersionForUpdate(oldCohort, eTag);

  const newName = data.name;
  const normalizedName = newName ? normalizeCohortName(newName) : oldCohort.name;
  if (newName) {
    const existingCohort = await getCohortByNameSafe({ cxId, name: normalizedName });
    if (existingCohort && existingCohort.id !== oldCohort.id) {
      throw new BadRequestError("A cohort with this name already exists", undefined, {
        existingCohortId: existingCohort.id,
        name: newName,
      });
    }
  }

  const newSettings = data.settings;
  const mergedSettings = newSettings
    ? await getMergedSettings({ cxId, oldSettings: oldCohort.settings, newSettings, log })
    : oldCohort.settings;

  const newData = {
    ...data,
    name: normalizedName,
    settings: mergedSettings,
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
  oldSettings: CohortSettings;
  newSettings: AllOptionalCohortSettings;
  log: typeof console.log;
}): Promise<CohortSettings> {
  if (newSettings) {
    await validateMonitoringSettingsForCx(cxId, newSettings.monitoring, log);
  }
  return mergeOldWithNewCohortSettings(oldSettings, newSettings);
}
