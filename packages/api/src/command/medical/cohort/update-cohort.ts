import { out } from "@metriport/core/util";
import { NotFoundError } from "@metriport/shared";
import { DeepPartial, mergeSettings } from "@metriport/shared/common/merge-settings";
import {
  CohortSettings,
  cohortSettingsSchema,
  CohortUpdateCmd,
  CohortWithSize,
} from "@metriport/shared/domain/cohort";
import { validateVersionForUpdate } from "../../../models/_default";
import { CohortModel } from "../../../models/medical/cohort";
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

  const monitoringSettings = data.settings?.monitoring;
  await validateMonitoringSettingsForCx(cxId, monitoringSettings, log);

  const mergedSettings = mergeSettings(
    oldCohort.settings,
    data.settings as DeepPartial<CohortSettings>
  );

  //Need to validate that the pharmacy and laboratory settings are valid (e.g., cannot have notifications and schedule at the same time)
  const validSettings = cohortSettingsSchema.parse(mergedSettings);

  const newData = {
    ...data,
    settings: validSettings,
  };
  const [updatedCohort, size] = await Promise.all([
    oldCohort.update(newData),
    getCohortSize({ cohortId: id, cxId }),
  ]);

  log(`Done. Updated cohort: ${JSON.stringify(updatedCohort.dataValues)}`);
  return { cohort: updatedCohort.dataValues, size };
}
