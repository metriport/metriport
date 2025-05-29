import dayjs, { ConfigType } from "dayjs";
import utc from "dayjs/plugin/utc";
import { CustomErrorParams, z } from "zod";
import { BadRequestError } from "../error/bad-request";

dayjs.extend(utc);

export const ISO_DATE = "YYYY-MM-DD";

/** @see https://day.js.org/docs/en/parse/is-valid  */
export function isValidISODate(date: string): boolean {
  return buildDayjs(date, ISO_DATE, true).isValid();
}

function isValidISODateOptional(date: string | undefined | null): boolean {
  return date ? isValidISODate(date) : true;
}

export function validateDateOfBirth(date: string): boolean {
  const parsedDate = buildDayjs(date);
  if (!parsedDate.isValid()) return false;
  return validateDateIsAfter1900(parsedDate.format(ISO_DATE));
}

export function validateIsPastOrPresent(date: string): boolean {
  if (!validateIsPastOrPresentSafe(date)) {
    throw new BadRequestError(`Date can't be in the future`, undefined, { date });
  }
  return true;
}
export function validateIsPastOrPresentSafe(date: string): boolean {
  if (buildDayjs(date).isAfter(buildDayjs())) return false;
  return true;
}

export function validateDateIsAfter1900(date: string): boolean {
  if (!isValidISODate(date)) return false;
  const yearStr = date.substring(0, 4);
  const year = Number(yearStr);
  return year >= 1900;
}

export function validateDateRange(start: string, end: string): boolean {
  if (buildDayjs(start).isAfter(end)) {
    throw new BadRequestError(`Invalid date range: 'start' must be before 'end'`, undefined, {
      start,
      end,
    });
  }
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

/**
 * Convert to YYYYMMDD or YYYY-MM-DD format
 * @param date - The date to convert
 * @param separator - The separator to use between the date components
 * @returns The date in YYYYMMDD or YYYY-MM-DD format (if separator is "-")
 */
export function convertDateToString(
  date: Date,
  { separator = "", useUtc = true }: { separator?: string; useUtc?: boolean } = {}
) {
  return (useUtc ? dayjs(date).utc() : dayjs(date)).format(["YYYY", "MM", "DD"].join(separator));
}

/**
 * Convert to HHMMSS or HHMMSSCC format
 * @param date - The date to convert
 * @param includeCentisecond - Whether to include the centisecond in the time string
 * @returns The date in HHMMSS or HHMMSSCC format (if includeCentisecond is true)
 */
export function convertDateToTimeString(
  date: Date,
  {
    useUtc = true,
    includeCentisecond = false,
  }: { useUtc?: boolean; includeCentisecond?: boolean } = {}
) {
  return (useUtc ? dayjs(date).utc() : dayjs(date)).format(
    includeCentisecond ? "HHmmssSS" : "HHmmss"
  );
}
/**
 * Validates if timestamp adheres to YYYYMMDDHHMMSS format
 * and is a valid date.
 *
 * @param input The HL7 timestamp to validate
 * @throws {BadRequestError} If the HL7 timestamp is invalid
 * @returns True if the HL7 timestamp is valid
 */
export function throwIfInvalidBasicIso8601(input: string): boolean {
  if (!input || input.length !== 14) {
    throw new BadRequestError("Invalid HL7 date string format: expected YYYYMMDDHHMMSS");
  }

  if (!/^\d{14}$/.test(input)) {
    throw new BadRequestError("Invalid HL7 date string: must contain only digits");
  }

  // Parse YYYYMMDDHHMMSS format
  const year = input.substring(0, 4);
  const month = input.substring(4, 6);
  const day = input.substring(6, 8);
  const hour = input.substring(8, 10);
  const minute = input.substring(10, 12);
  const second = input.substring(12, 14);

  // Validate date components
  const monthNum = parseInt(month);
  const dayNum = parseInt(day);
  const hourNum = parseInt(hour);
  const minuteNum = parseInt(minute);
  const secondNum = parseInt(second);

  if (monthNum < 1 || monthNum > 12) {
    throw new BadRequestError("Invalid month in HL7 date string");
  }
  if (dayNum < 1 || dayNum > 31) {
    throw new BadRequestError("Invalid day in HL7 date string");
  }
  if (hourNum > 23 || minuteNum > 59 || secondNum > 59) {
    throw new BadRequestError("Invalid time in HL7 date string");
  }

  const dateStr = `${year}-${month}-${day}T${hour}:${minute}:${second}Z`;
  const parsedDate = buildDayjs(dateStr);

  if (!parsedDate.isValid()) {
    throw new BadRequestError("Invalid HL7 timestamp");
  }

  return true;
}

/**
 * Converts an HL7 timestamp to an ISO 8601 formatted date string.
 *
 * @param hl7DateString The HL7 timestamp to convert
 * @returns ISO 8601 formatted date string
 */
export function basicToExtendedIso8601(basicIso8601: string): string {
  throwIfInvalidBasicIso8601(basicIso8601);

  const year = basicIso8601.substring(0, 4);
  const month = basicIso8601.substring(4, 6);
  const day = basicIso8601.substring(6, 8);
  const hour = basicIso8601.substring(8, 10);
  const minute = basicIso8601.substring(10, 12);
  const second = basicIso8601.substring(12, 14);

  return `${year}-${month}-${day}T${hour}:${minute}:${second}`;
}
