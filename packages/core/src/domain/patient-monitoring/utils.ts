import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";

dayjs.extend(duration);

export const defaultRemainingAttempts = 7;

const backoffOne = 5 * 60 * 1000; // 5 minutes
const backoffTwo = 30 * 60 * 1000; // 30 minutes
const backoffThree = 4 * 60 * 60 * 1000; // 4 hours
const backoffFour = 12 * 60 * 60 * 1000; // 12 hours
const backoffFive = 1 * 24 * 60 * 60 * 1000; // 1 day
const backoffSix = 2 * 24 * 60 * 60 * 1000; // 2 days
const backoffSeven = 4 * 24 * 60 * 60 * 1000; // 4 days

const dischargeRequerySchedule = {
  1: dayjs.duration({ milliseconds: backoffOne }),
  2: dayjs.duration({ milliseconds: backoffTwo }),
  3: dayjs.duration({ milliseconds: backoffThree }),
  4: dayjs.duration({ milliseconds: backoffFour }),
  5: dayjs.duration({ milliseconds: backoffFive }),
  6: dayjs.duration({ milliseconds: backoffSix }),
  7: dayjs.duration({ milliseconds: backoffSeven }),
};

export function calculateScheduledAt(newAttempts: number): Date {
  const attemptNumber = defaultRemainingAttempts - newAttempts + 1;
  const backoffDurationMs =
    dischargeRequerySchedule[
      attemptNumber as keyof typeof dischargeRequerySchedule
    ].asMilliseconds();

  const now = Date.now();
  const nextScheduledAt = dayjs(now).add(backoffDurationMs).toDate();

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
