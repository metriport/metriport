import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { buildDayjs } from "../../../common/date";
import { z } from "zod";

dayjs.extend(duration);

export const backoffOne = dayjs.duration({ minutes: 5 }).asMilliseconds();
export const backoffTwo = dayjs.duration({ minutes: 30 }).asMilliseconds();
export const backoffThree = dayjs.duration({ hours: 4 }).asMilliseconds();
export const backoffFour = dayjs.duration({ days: 1 }).asMilliseconds();
export const backoffFive = dayjs.duration({ days: 2 }).asMilliseconds();
export const backoffSix = dayjs.duration({ days: 4 }).asMilliseconds();

const dischargeRequerySchedule = {
  1: dayjs.duration({ milliseconds: backoffOne }),
  2: dayjs.duration({ milliseconds: backoffTwo }),
  3: dayjs.duration({ milliseconds: backoffThree }),
  4: dayjs.duration({ milliseconds: backoffFour }),
  5: dayjs.duration({ milliseconds: backoffFive }),
  6: dayjs.duration({ milliseconds: backoffSix }),
};
export const defaultRemainingAttempts = Object.keys(dischargeRequerySchedule).length;

//TODO: Remove this once we confirm this is no longer used
export const dispositionRetryBackoffOne = dayjs.duration({ hours: 6 }).asMilliseconds();
export const dispositionRetryBackoffTwo = dayjs.duration({ days: 1 }).asMilliseconds();
export const dispositionRetryBackoffThree = dayjs.duration({ days: 2 }).asMilliseconds();
export const dispositionRetryBackoffFour = dayjs.duration({ days: 3 }).asMilliseconds();

const dispositionRetrySchedule = {
  4: dayjs.duration({ milliseconds: dispositionRetryBackoffOne }),
  3: dayjs.duration({ milliseconds: dispositionRetryBackoffTwo }),
  2: dayjs.duration({ milliseconds: dispositionRetryBackoffThree }),
  1: dayjs.duration({ milliseconds: dispositionRetryBackoffFour }),
};

export const defaultDispositionRetryAttempts = Object.keys(dispositionRetrySchedule).length;
// END OF TODO

export const dischargeRequeryRetryBackoffOne = dayjs.duration({ hours: 6 }).asMilliseconds();
export const dischargeRequeryRetryBackoffTwo = dayjs.duration({ days: 1 }).asMilliseconds();
export const dischargeRequeryRetryBackoffThree = dayjs.duration({ days: 2 }).asMilliseconds();

const dischargeRequeryRetrySchedule = {
  3: dayjs.duration({ milliseconds: dischargeRequeryRetryBackoffOne }),
  2: dayjs.duration({ milliseconds: dischargeRequeryRetryBackoffTwo }),
  1: dayjs.duration({ milliseconds: dischargeRequeryRetryBackoffThree }),
};

export const defaultDischargeRequeryRetryAttempts = Object.keys(
  dischargeRequeryRetrySchedule
).length;

export function calculateDischargeRequeryRetryScheduledAt(attemptsRemaining: number): Date {
  const backoffDuration =
    dischargeRequeryRetrySchedule[attemptsRemaining as keyof typeof dischargeRequeryRetrySchedule];
  if (!backoffDuration) {
    throw new Error(`Invalid dischargeRequeriesRemaining: ${attemptsRemaining}`);
  }
  return buildDayjs().add(backoffDuration.asMilliseconds(), "milliseconds").toDate();
}

export function calculateScheduledAt(newAttempts: number): Date {
  const attemptNumber = defaultRemainingAttempts - newAttempts + 1;
  const backoffDurationMs =
    dischargeRequerySchedule[
      attemptNumber as keyof typeof dischargeRequerySchedule
    ].asMilliseconds();

  const nextScheduledAt = buildDayjs().add(backoffDurationMs, "milliseconds").toDate();

  return nextScheduledAt;
}

// TODO: Remove this once we confirm this is no longer used
export function calculateDispositionRetryScheduledAt(attemptsRemaining: number): Date {
  const backoffDuration =
    dispositionRetrySchedule[attemptsRemaining as keyof typeof dispositionRetrySchedule];
  if (!backoffDuration) {
    throw new Error(`Invalid dispositionRetryAttemptsRemaining: ${attemptsRemaining}`);
  }
  return buildDayjs().add(backoffDuration.asMilliseconds(), "milliseconds").toDate();
}

export function pickLargestRemainingAttempts(
  existingAttempts: number,
  newAttempts: number
): number {
  return Math.max(existingAttempts, newAttempts);
}

export function earliest(existingDate: Date, newDate: Date): Date {
  const existingDateMs = existingDate.getTime();
  const newDateMs = newDate.getTime();
  return existingDateMs < newDateMs ? existingDate : newDate;
}

export const PATIENT_MONITORING_CADENCES = ["weekly", "biweekly", "monthly"] as const;
export const PatientMonitoringCadence = {
  WEEKLY: "weekly",
  BIWEEKLY: "biweekly",
  MONTHLY: "monthly",
} as const;
export const patientMonitoringCadenceSchema = z.enum(PATIENT_MONITORING_CADENCES);
export type PatientMonitoringCadence = z.infer<typeof patientMonitoringCadenceSchema>;

/**
 * Checks if a monitoring setting (e.g., HIE or pharmacy) should run based on cadences.
 *
 * @param setting - The monitoring setting with enabled flag and frequency
 * @param cadences - Array of cadences to check against (e.g., ["weekly", "biweekly"])
 * @returns true if the setting is enabled AND its frequency matches any cadence
 */
export function shouldPullDataForMonitoringSource(
  setting: { enabled: boolean; frequency: PatientMonitoringCadence },
  cadences: PatientMonitoringCadence[]
): boolean {
  if (!setting.enabled) {
    return false;
  }
  return cadences.includes(setting.frequency);
}
