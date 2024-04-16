import { z } from "zod";
import dayjs from "dayjs";

export const ISO_DATE = "YYYY-MM-DD";

export function isValidISODate(date: string): boolean {
  return dayjs(date, ISO_DATE, true).isValid();
}

const isValidISODateOptional = (date: string | undefined | null): boolean =>
  date ? isValidISODate(date) : true;

export const optionalDateSchema = z
  .string()
  .trim()
  .nullish()
  .refine(isValidISODateOptional, { message: "Invalid ISO date" });

export const elapsedTimeFromNow = (
  date?: Date,
  format: dayjs.UnitTypeLong = "millisecond"
): number => {
  return dayjs().diff(dayjs(date), format);
};
