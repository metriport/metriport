import dayjs, { ConfigType } from "dayjs";
import utc from "dayjs/plugin/utc";
import { CustomErrorParams, z } from "zod";
import { BadRequestError } from "../error/bad-request";

dayjs.extend(utc);

export const ISO_DATE = "YYYY-MM-DD";
export const AMERICAN_DATE = "MM/DD/YYYY";

/** @see https://day.js.org/docs/en/parse/is-valid  */
export function isValidISODate(date: string): boolean {
  return buildDayjs(date, ISO_DATE, true).isValid();
}

function isValidISODateOptional(date: string | undefined | null): boolean {
  return date ? isValidISODate(date) : true;
}

export function isValidAmericanDate(date: string): boolean {
  return buildDayjs(date, AMERICAN_DATE, true).isValid();
}

export function validateDateOfBirthSafe(date: string): boolean {
  if (date.length !== 10) return false;
  if (!isValidAmericanDate(date)) return false;
  if (!isValidISODate(date)) return false;
  return validateIsPastOrPresentSafe(date) && validateDateIsAfter1900Safe(date);
}

export function validateIsPastOrPresent(date: string): boolean {
  if (!validateIsPastOrPresentSafe(date)) {
    throw new BadRequestError(`Date can't be in the future`, undefined, { date });
  }
  return true;
}

export function validateIsPastOrPresentSafe(date: string): boolean {
  const dateToCheck = buildDayjs(date);
  if (!dateToCheck.isValid()) return false;
  const now = buildDayjs();
  return dateToCheck.isSame(now) || dateToCheck.isBefore(now);
}

export function validateIsAfter1900(date: string): boolean {
  if (!validateDateIsAfter1900Safe(date)) {
    throw new BadRequestError(`Date can't be before 1900`, undefined, { date });
  }
  return true;
}

export function validateDateIsAfter1900Safe(date: string): boolean {
  const dateToCheck = buildDayjs(date);
  if (!dateToCheck.isValid()) return false;
  const date19000101 = buildDayjs("1900-01-01");
  return dateToCheck.isSame(date19000101) || dateToCheck.isAfter(date19000101);
}

export function validateDateRange(start: string, end: string): boolean {
  if (!validateDateRangeSafe(start, end)) {
    throw new BadRequestError(`Invalid date range: 'start' must be before 'end'`, undefined, {
      start,
      end,
    });
  }
  return true;
}

export function validateDateRangeSafe(start: string, end: string): boolean {
  const dateToCheckStart = buildDayjs(start);
  const dateToCheckEnd = buildDayjs(end);
  if (!dateToCheckStart.isValid() || !dateToCheckEnd.isValid()) return false;
  if (dateToCheckStart.isAfter(dateToCheckEnd)) return false;
  return true;
}

const invalidIsoMsg: CustomErrorParams = { message: "Invalid ISO date" };

export const optionalDateSchema = z
  .string()
  .trim()
  .nullish()
  .refine(isValidISODateOptional, invalidIsoMsg);

export const dateSchema = z.string().trim().refine(isValidISODate, invalidIsoMsg);

export function elapsedTimeFromNow(
  date?: Date,
  format: dayjs.UnitTypeLong = "millisecond"
): number {
  return buildDayjs().diff(buildDayjs(date), format);
}

export function buildDayjs(date?: ConfigType, format?: string, strict?: boolean): dayjs.Dayjs {
  return dayjs.utc(date, format, strict);
}

/**
 * Tries to parse a compact date string in the format YYYYMMDDhhmmss±hhmm
 * (year, month, day, hour, minute, second, timezone)
 * and converts it to ISO 8601 format.
 *
 * @param input The compact date string to parse
 * @returns ISO 8601 formatted date string or undefined if input doesn't match expected format
 */
function tryParseCompactDate(input: string): string | undefined {
  const match = input.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})([+-])(\d{2})(\d{2})$/);
  if (!match) return undefined;

  const [, year, month, day, hour, minute, second, sign, tzHour, tzMinute] = match;
  return `${year}-${month}-${day}T${hour}:${minute}:${second}${sign}${tzHour}:${tzMinute}`;
}

export function buildDayjsFromCompactDate(
  date?: ConfigType,
  format?: string,
  strict?: boolean
): dayjs.Dayjs {
  if (typeof date === "string") {
    const parsed = tryParseCompactDate(date);
    if (parsed) return buildDayjs(parsed, format, strict);
  }
  return buildDayjs(date, format, strict);
}

export function sortDate(
  date1: ConfigType,
  date2: ConfigType,
  sortingOrder: "asc" | "desc" = "asc"
): number {
  return sortingOrder === "desc"
    ? buildDayjs(date1).diff(buildDayjs(date2))
    : buildDayjs(date2).diff(buildDayjs(date1));
}
