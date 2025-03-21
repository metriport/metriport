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
  return validateIsPastOrPresent(date) && validateDateIsAfter1900(date);
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
  const dateToCheck = buildDayjs(date);
  const year1900 = buildDayjs("1900-01-01");
  return dateToCheck.isSame(year1900) || dateToCheck.isAfter(year1900);
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

export function sortDate(
  date1: ConfigType,
  date2: ConfigType,
  sortingOrder: "asc" | "desc" = "asc"
): number {
  return sortingOrder === "desc"
    ? buildDayjs(date1).diff(buildDayjs(date2))
    : buildDayjs(date2).diff(buildDayjs(date1));
}
