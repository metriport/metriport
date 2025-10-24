import {
  isQuestFeatureFlagEnabledForCx,
  isSurescriptsFeatureFlagEnabledForCx,
  isSurescriptsNotificationsFeatureFlagEnabledForCx,
} from "@metriport/core/command/feature-flags/domain-ffs";
import { BadRequestError } from "@metriport/shared";
import { AllOptionalMonitoringSchema } from "@metriport/shared/domain/cohort";
import { PatientCohortModel } from "../../../models/medical/patient-cohort";

export async function validateMonitoringSettingsForCx(
  cxId: string,
  monitoring: AllOptionalMonitoringSchema | undefined,
  log: typeof console.log
): Promise<void> {
  log(`Validating monitoring settings for cx: ${cxId}`);

  if (monitoring?.adt?.enabled) {
    const isAdtEnabled = true; //TODO: Check if the cx is subscribed to ADTs
    if (!isAdtEnabled) {
      throw new BadRequestError("ADT is not enabled for your account", undefined, {
        monitoringSettings: JSON.stringify(monitoring),
      });
    }
  }

  if (monitoring?.pharmacy?.notifications) {
    const isSurescriptsNotificationsEnabled =
      await isSurescriptsNotificationsFeatureFlagEnabledForCx(cxId);
    if (!isSurescriptsNotificationsEnabled) {
      throw new BadRequestError(
        "Pharmacy Notifications are not enabled for your account",
        undefined,
        {
          monitoringSettings: JSON.stringify(monitoring),
        }
      );
    }
  }
  if (monitoring?.pharmacy?.schedule && monitoring?.pharmacy?.schedule.enabled) {
    const isSurescriptsEnabled = await isSurescriptsFeatureFlagEnabledForCx(cxId);
    if (!isSurescriptsEnabled) {
      throw new BadRequestError("Pharmacy Schedule is not enabled for your account", undefined, {
        monitoringSettings: JSON.stringify(monitoring),
      });
    }
  }

  const isCxRequestingQuest =
    monitoring?.laboratory?.notifications ||
    (monitoring?.laboratory?.schedule && monitoring?.laboratory?.schedule.enabled);
  if (isCxRequestingQuest) {
    const isQuestEnabled = await isQuestFeatureFlagEnabledForCx(cxId);
    if (!isQuestEnabled) {
      throw new BadRequestError(
        "Laboratory Notifications and Schedule are not enabled for your account",
        undefined,
        {
          monitoringSettings: JSON.stringify(monitoring),
        }
      );
    }
  }

  log(`Monitoring settings are valid for cx: ${cxId}`);
}

export async function getPatientIdsInCohort({
  cohortId,
  cxId,
}: {
  cohortId: string;
  cxId: string;
}): Promise<string[]> {
  const patients = await PatientCohortModel.findAll({
    attributes: ["patientId"],
    where: { cohortId, cxId },
  });

  return patients.map(p => p.patientId);
}
