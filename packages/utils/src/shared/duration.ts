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
 * Returns the delay time in milliseconds.
 *
 * Read the time IN MILLISECONDS from the file path set in the `delayTimeFileName` parameter.
 *
 * The file should contain a single line, with the delay time in milliseconds.
 *
 * This is useful to update the delay time in-flight, while scripts are running
 * (e.g., to adjust the rate at which we query the API while the script is running).
 *
 * If the file doesn't exist, it will use the default delay time.
 */
export function getDelayTime({
  delayTimeFileName = "delay-time-in-millis.txt",
  minimumDelayTime = dayjs.duration(100, "milliseconds"),
  defaultDelayTime = dayjs.duration(5, "seconds"),
  maxDelayTime = dayjs.duration(10, "minutes"),
  log = console.log,
}: {
  delayTimeFileName?: string;
  minimumDelayTime?: Duration;
  defaultDelayTime?: Duration;
  maxDelayTime?: Duration;
  log?: typeof console.log;
}): number {
  try {
    const delayTimeRaw = getFileContents(delayTimeFileName);
    const delayTimeInMillis = parseInt(delayTimeRaw);
    if (!isNaN(delayTimeInMillis)) {
      if (delayTimeInMillis < maxDelayTime.asMilliseconds()) {
        return Math.max(delayTimeInMillis, minimumDelayTime.asMilliseconds());
      } else {
        log(
          `>>> Delay time is greater than 10 minutes (${delayTimeInMillis} milliseconds). ` +
            `Using default delay time (${defaultDelayTime.asMilliseconds()} milliseconds).`
        );
      }
    }
  } catch (error) {
    // no-op
  }
  return defaultDelayTime.asMilliseconds();
}
