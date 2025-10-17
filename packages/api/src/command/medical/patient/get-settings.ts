import {
  AllOptionalCohortSettings,
  CohortFrequency,
  CohortSettings,
  FREQUENCY_PRIORITY,
  NotificationSchedule,
  Schedule,
} from "@metriport/shared/domain/cohort";
import { getCohortsForPatient } from "../cohort/get-cohort";
import { DeepPartial, mergeSettings } from "@metriport/shared/common/merge-settings";

/**
 * Gets the merged settings for a patient.
 * @param cxId The customer ID
 * @param patientId The patient ID
 * @returns The settings for the patient
 */
export async function getPatientSettings({
  cxId,
  patientId,
}: {
  cxId: string;
  patientId: string;
}): Promise<CohortSettings> {
  const cohorts = await getCohortsForPatient({ cxId, patientId });
  const settings = cohorts.map(_ => _.settings);
  return mergeCohortsSettings(settings);
}

/**
 * Merges an array of cohort settings into a single cohort settings object.
 * @param cohortArray Array of cohort settings to merge
 * @returns Merged cohort settings
 */
export function mergeCohortsSettings(cohortArray: CohortSettings[]): CohortSettings {
  return cohortArray.reduce((aggregate, current) => mergeCohortSettings(aggregate, current));
}

function mergeCohortSettings(a: CohortSettings, b: CohortSettings): CohortSettings {
  return {
    monitoring: {
      adt: a.monitoring.adt || b.monitoring.adt,
      hie: mergeSchedules(a.monitoring.hie, b.monitoring.hie),
      pharmacy: mergeNotificationSchedules(a.monitoring.pharmacy, b.monitoring.pharmacy),
      laboratory: mergeNotificationSchedules(a.monitoring.laboratory, b.monitoring.laboratory),
    },
  };
}

/**
 * Merges two schedules. Picks the shorter frequency.
 * If enabled is provided, it will be used that value, otherwise it will be the logical OR of the two schedules.
 * @param a Schedule 1
 * @param b Schedule 2
 * @param enabled What the enabled value should be. If not provided, it will be the logical OR of the two schedules.
 * @returns The merged schedule
 */
function mergeSchedules(a: Schedule, b: Schedule, enabled?: boolean): Schedule {
  return {
    // We do this because notifications and schedule can't be enabled at the same time
    enabled: enabled !== undefined ? enabled : a.enabled || b.enabled,
    frequency: mergeFrequencies(a.frequency, b.frequency),
  };
}

function mergeFrequencies(a: CohortFrequency, b: CohortFrequency): CohortFrequency {
  return FREQUENCY_PRIORITY[a] < FREQUENCY_PRIORITY[b] ? a : b;
}

function mergeNotificationSchedules(
  a: NotificationSchedule,
  b: NotificationSchedule
): NotificationSchedule {
  if (a.notifications || b.notifications) {
    return {
      notifications: true,
      schedule: mergeSchedules(a.schedule, b.schedule, false),
    };
  } else {
    return {
      notifications: false,
      schedule: mergeSchedules(a.schedule, b.schedule),
    };
  }
}

/**
 * Merges complete and uncomplete cohort settings into a single cohort settings object. Takes the old settings as the base and merges the new settings into it.
 * If a new setting is undefined, the old value is used. !!Otherwise, the new value is used!!
 * @param oldSettings Old cohort settings
 * @param newSettings New cohort settings
 * @returns Merged cohort settings
 */
export function mergeOldWithNewCohortSettings(
  oldSettings: CohortSettings,
  newSettings: AllOptionalCohortSettings
) {
  return mergeSettings(oldSettings, newSettings as DeepPartial<CohortSettings>);
}
