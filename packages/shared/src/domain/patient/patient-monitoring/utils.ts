import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { buildDayjs } from "../../../common/date";

dayjs.extend(duration);

export const backoffOne = 5 * 60 * 1000; // 5 minutes
export const backoffTwo = 30 * 60 * 1000; // 30 minutes
export const backoffThree = 4 * 60 * 60 * 1000; // 4 hours
export const backoffFour = 1 * 24 * 60 * 60 * 1000; // 1 day
export const backoffFive = 2 * 24 * 60 * 60 * 1000; // 2 days
export const backoffSix = 4 * 24 * 60 * 60 * 1000; // 4 days

const dischargeRequerySchedule = {
  1: dayjs.duration({ milliseconds: backoffOne }),
  2: dayjs.duration({ milliseconds: backoffTwo }),
  3: dayjs.duration({ milliseconds: backoffThree }),
  4: dayjs.duration({ milliseconds: backoffFour }),
  5: dayjs.duration({ milliseconds: backoffFive }),
  6: dayjs.duration({ milliseconds: backoffSix }),
};
export const defaultRemainingAttempts = Object.keys(dischargeRequerySchedule).length;

export function calculateScheduledAt(newAttempts: number): Date {
  const attemptNumber = defaultRemainingAttempts - newAttempts + 1;
  const backoffDurationMs =
    dischargeRequerySchedule[
      attemptNumber as keyof typeof dischargeRequerySchedule
    ].asMilliseconds();

  const nextScheduledAt = buildDayjs().add(backoffDurationMs, "milliseconds").toDate();

  return nextScheduledAt;
}

export function pickLargestRemainingAttempts(
  existingAttempts: number,
  newAttempts: number
): number {
  return Math.max(existingAttempts, newAttempts);
}

export function pickEarliestScheduledAt(existingDate: Date, newDate: Date): Date {
  const existingDateMs = existingDate.getTime();
  const newDateMs = newDate.getTime();
  return existingDateMs < newDateMs ? existingDate : newDate;
}
