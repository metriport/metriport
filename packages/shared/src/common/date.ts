import dayjs, { ConfigType } from "dayjs";
import utc from "dayjs/plugin/utc";

import { CustomErrorParams, z } from "zod";

dayjs.extend(utc);

export const ISO_DATE = "YYYY-MM-DD";

export function isValidISODate(date: string): boolean {
  return buildDayjs(date, ISO_DATE, true).isValid();
}

const isValidISODateOptional = (date: string | undefined | null): boolean =>
  date ? isValidISODate(date) : true;

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
