import { out } from "@metriport/core/util";
import { BadRequestError, NotFoundError } from "@metriport/shared";
import { CohortUpdateCmd, CohortWithSize } from "@metriport/shared/domain/cohort";
import { validateVersionForUpdate } from "../../../models/_default";
import { CohortModel } from "../../../models/medical/cohort";
import { mergeOldWithNewCohortSettings } from "../../medical/patient/get-settings";
import { getCohortSize } from "./patient-cohort/get-cohort-size";
import { validateMonitoringSettingsForCx } from "./utils";
import { getCohortByNameSafe } from "./get-cohort";

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
  if (newName) {
    const existingCohort = await getCohortByNameSafe({ cxId, name: newName });
    if (existingCohort && existingCohort.id !== oldCohort.id) {
      throw new BadRequestError("A cohort with this name already exists", undefined, {
        existingCohortId: existingCohort.id,
        name: newName,
      });
    }
  }

  const monitoringSettings = data.settings?.monitoring;
  await validateMonitoringSettingsForCx(cxId, monitoringSettings, log);

  const mergedSettings = mergeOldWithNewCohortSettings(oldCohort.settings, data.settings);

  const newData = {
    ...data,
    settings: mergedSettings,
  };
  const [updatedCohort, size] = await Promise.all([
    oldCohort.update(newData),
    getCohortSize({ cohortId: id, cxId }),
  ]);

  log(`Done. Updated cohort: ${JSON.stringify(updatedCohort.dataValues)}`);
  return { cohort: updatedCohort.dataValues, size };
}
