import { formatNumber } from "@metriport/shared/common/numbers";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";

dayjs.extend(duration);

export function elapsedTimeAsStr(startedAt: number, finishedAt = Date.now()) {
  const ellapsedTime = dayjs.duration(finishedAt - startedAt);
  const timeInMin = formatNumber(ellapsedTime.asMinutes());
  const timeInMillis = formatNumber(ellapsedTime.asMilliseconds());
  return `${timeInMillis} millis / ${timeInMin} min`;
}
