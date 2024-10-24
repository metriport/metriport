import dayjs, { Dayjs, ConfigType } from "dayjs";
import utc from "dayjs/plugin/utc";

import { CustomErrorParams, z } from "zod";
import { BadRequestError } from "../error/bad-request";

dayjs.extend(utc);

export const ISO_DATE = "YYYY-MM-DD";

export function isValidISODate(date: string): boolean {
  return buildDayjs(date, ISO_DATE, true).isValid();
}

function isValidISODateOptional(date: string | undefined | null): boolean {
  return date ? isValidISODate(date) : true;
}

export function validateIsPastOrPresent(date: string | Dayjs): boolean {
  if (!validateIsPastOrPresentSafe(date)) {
    throw new BadRequestError(`Date can't be in the future`, undefined, {
      date: typeof date === "string" ? date : date.toISOString(),
    });
  }
  return true;
}
export function validateIsPastOrPresentSafe(date: string | Dayjs): boolean {
  if (dayjs(date).isAfter(dayjs())) return false;
  return true;
}

export function validateDateRange(start: string, end: string): boolean {
  if (dayjs(start).isAfter(end)) {
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
