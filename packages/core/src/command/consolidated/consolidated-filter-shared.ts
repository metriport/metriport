import { Period, Range } from "@medplum/fhirtypes";
import { buildDayjs } from "@metriport/shared/common/date";
import { filterTruthy } from "@metriport/shared/common/filter-map";
import dayjs from "dayjs";
import customParseFormat from "dayjs/plugin/customParseFormat";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";

dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);
dayjs.extend(customParseFormat);

export type DateRange = {
  dateFrom?: string | undefined;
  dateTo?: string | undefined;
};

export function arePeriodsWithinRange(
  periods: (Period | undefined)[] | undefined,
  range: DateRange
): boolean | undefined {
  // we need to check if the periods are valid before we call `.some`, b/c that will always return
  // boolean and we need to return undefined if there are no valid periods to check - so upstream
  // functions can check other fields
  const periodsWithSomeDate = periods?.flatMap(p => (p?.start || p?.end ? p : [])) ?? [];
  if (periodsWithSomeDate.length < 1) return undefined;
  return periodsWithSomeDate.some(period => isPeriodWithinRange(period, range));
}
export function isPeriodWithinRange(
  period: Period | undefined,
  range: DateRange
): boolean | undefined {
  const dates = getDatesFromPeriod(period);
  return areDatesWithinRange(dates, range);
}

export function areRangesWithinRange(
  ranges: (Range | undefined)[] | undefined,
  range: DateRange
): boolean | undefined {
  const rangesWithSomeDate = ranges?.flatMap(r => (r?.low || r?.high ? r : [])) ?? [];
  if (rangesWithSomeDate.length < 1) return undefined;
  return rangesWithSomeDate.some(currRange => {
    const dates = getDateFromRange(currRange);
    return areDatesWithinRange(dates, range);
  });
}

/**
 * Checks if any date in the array is within the date range.
 * @param dates - An array of dates to check.
 * @param range - The date range to check against.
 * @returns - True if any date is within the range, false otherwise.
 */
export function areDatesWithinRange(
  dates: (string | undefined)[],
  range: DateRange | undefined
): boolean | undefined {
  // we need to check if the dates are valid before we call `.some`, b/c that will always return boolean
  // and we need to return undefined if there are no valid dates to check - so upstream functions can
  // check other fields
  const parsedDates = dates.flatMap(date => safeDate(date) ?? []);
  if (parsedDates.length < 1) return undefined;
  return parsedDates.some(date => isDateWithinDateRange(date, range));
}
/**
 * Checks the date is within the date range.
 * @param date - The date to check.
 * @param range - The date range to check against.
 * @returns - True if the date is within the range, false otherwise.
 */
export function isDateWithinDateRange(
  date: string | undefined,
  range: DateRange | undefined
): boolean | undefined {
  if (!date || !safeDate(date)) return undefined;
  if (!range) return undefined;
  if (range.dateFrom && range.dateTo) {
    return (
      buildDayjs(date).isSameOrAfter(buildDayjs(range.dateFrom).startOf("day")) &&
      buildDayjs(date).isSameOrBefore(buildDayjs(range.dateTo).endOf("day"))
    );
  }
  if (range.dateFrom) {
    return buildDayjs(date).isSameOrAfter(buildDayjs(range.dateFrom).startOf("day"));
  }
  if (range.dateTo) {
    return buildDayjs(date).isSameOrBefore(buildDayjs(range.dateTo).endOf("day"));
  }
  return undefined;
}

export function getDatesFromPeriod(period?: Period): string[] {
  return [safeDate(period?.start), safeDate(period?.end)].flatMap(filterTruthy);
}

export function getTimestampRange(range?: Range): number[] {
  return [range?.low?.value, range?.high?.value].flatMap(filterTruthy);
}

export function getDateFromRange(range?: Range): string[] {
  return timestampToDate(getTimestampRange(range));
}

export function getDatesFromEffectiveDateTimeOrPeriod(resource: {
  effectiveDateTime?: string;
  effectivePeriod?: Period;
}): (string | undefined)[] {
  return [
    resource.effectiveDateTime,
    resource.effectivePeriod?.start,
    resource.effectivePeriod?.end,
  ];
}

// export function addAgeToDob(dob: string | undefined, age: Age): string | undefined {
//   if (!dob) return undefined;
//   if (!age.value) return undefined;
//   const dayjsUnit = ageUnitToDayjsUnit(age.unit);
//   if (!dayjsUnit) return undefined; // could try to infer based on the DOB + current date
//   return buildDayjs(dob).add(age.value, dayjsUnit).toISOString();
// }

export function timestampToDate(timestamp: string[] | number[] | undefined): string[] {
  if (!timestamp) return [];
  return timestamp.map(date => {
    if (typeof date === "string") return date;
    return buildDayjs(date).toISOString();
  });
}

export function safeDate(date: string | number | undefined): string | undefined {
  if (!date) return undefined;
  const dateAsDayjs = buildDayjs(date);
  if (
    !dateAsDayjs.isValid() ||
    dateAsDayjs.isBefore(buildDayjs("1900-01-01")) ||
    dateAsDayjs.isAfter(buildDayjs("2100-01-01"))
  ) {
    return undefined;
  }
  if (typeof date === "number") return buildDayjs(date).toISOString();
  return date;
}

/**
 * Some resources are ongoing conditions, so when their property is a single point in time, we want
 * to only consider the start of the date range.
 */
export function dateRangeToOngoing(range?: DateRange): DateRange | undefined {
  if (!range || !range.dateFrom) return undefined;
  const ongoing = { dateFrom: range.dateFrom };
  return ongoing;
}
