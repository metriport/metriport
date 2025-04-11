import { getFileContents } from "@metriport/core/util/fs";
import { formatNumber } from "@metriport/shared/common/numbers";
import dayjs from "dayjs";
import duration, { Duration } from "dayjs/plugin/duration";

dayjs.extend(duration);

export function elapsedTimeAsStr(startedAt: number, finishedAt = Date.now()) {
  const ellapsedTime = dayjs.duration(finishedAt - startedAt);
  const timeInMin = formatNumber(ellapsedTime.asMinutes());
  const timeInMillis = formatNumber(ellapsedTime.asMilliseconds());
  return `${timeInMillis} millis / ${timeInMin} min`;
}

/**
 * Returns the delay time in milliseconds. Read from the file on each call so we can update it live
 * and adjust the rate at which we query the API while the script is running.
 * If the file doesn't exist, it will use the default delay time.
 */
export function getDelayTime({
  delayTimeFileName = "delay-time-in-seconds.txt",
  minimumDelayTime = dayjs.duration(3, "seconds"),
  defaultDelayTime = dayjs.duration(10, "seconds"),
  log = console.log,
}: {
  delayTimeFileName?: string;
  minimumDelayTime?: Duration;
  defaultDelayTime?: Duration;
  log?: typeof console.log;
}): number {
  try {
    const delayTimeRaw = getFileContents(delayTimeFileName);
    const delayTime = parseInt(delayTimeRaw);
    if (!isNaN(delayTime)) {
      if (delayTime < 600) {
        const delayTimeInMillis = delayTime * 1000;
        return Math.max(delayTimeInMillis, minimumDelayTime.asMilliseconds());
      } else {
        log(
          `>>> Delay time is greater than 10 minutes (${delayTime} seconds). ` +
            `Using default delay time (${defaultDelayTime.asSeconds()} seconds).`
        );
      }
    }
  } catch (error) {
    // no-op
  }
  return defaultDelayTime.asMilliseconds();
}
