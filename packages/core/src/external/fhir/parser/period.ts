import { Period } from "@medplum/fhirtypes";
import { buildDayjs } from "@metriport/shared/common/date";
import { ManipulateType as TimeIntervalUnit } from "dayjs";
import { parseNumber } from "./number";

const TIME_INTERVAL_UNITS = new Set<TimeIntervalUnit>([
  "d",
  "D",
  "M",
  "y",
  "h",
  "m",
  "s",
  "ms",
  "millisecond",
  "milliseconds",
  "second",
  "seconds",
  "minute",
  "minutes",
  "hour",
  "hours",
  "day",
  "days",
  "week",
  "weeks",
  "month",
  "months",
  "year",
  "years",
]);

export function parsePeriodFromString(periodString: string): Period | undefined {
  const parsed = parseNumber(periodString);
  if (parsed == null) return undefined;

  const periodUnit = parsed.remainder.trim().toLowerCase();
  if (TIME_INTERVAL_UNITS.has(periodUnit as TimeIntervalUnit)) {
    const start = buildDayjs();
    const end = start.add(parsed.value, periodUnit as TimeIntervalUnit);

    return {
      start: start.toISOString(),
      end: end.toISOString(),
    };
  }
  return undefined;
}
