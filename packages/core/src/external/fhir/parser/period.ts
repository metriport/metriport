import { Period } from "@medplum/fhirtypes";
import { buildDayjs } from "@metriport/shared/common/date";
import { ManipulateType } from "dayjs";
import { parseNumber } from "./number";

const MANIPULATE_TYPE_VALUE = new Set<ManipulateType>([
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
  const { value, remainder } = parseNumber(periodString);
  if (value == null) return undefined;

  const periodUnit = remainder.trim().toLowerCase();
  if (MANIPULATE_TYPE_VALUE.has(periodUnit as ManipulateType)) {
    const start = buildDayjs();
    const end = start.add(value, periodUnit as ManipulateType);

    return {
      start: start.toISOString(),
      end: end.toISOString(),
    };
  }
  return undefined;
}
