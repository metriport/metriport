import dayjs from "dayjs";
import { z } from "zod";
import { ISO_DATE, isValidISODate, validateIsPastOrPresentSafe } from "../common/date";

export function normalizeDateSafe(date: string): string | undefined {
  const trimmedDate = date.trim();
  const parsedDate = dayjs(trimmedDate);
  if (!parsedDate.isValid()) return undefined;
  return parsedDate.format(ISO_DATE);
}

export function normalizeDate(date: string): string {
  const dateOrUndefined = normalizeDateSafe(date);
  if (!dateOrUndefined) throw new Error("Invalid date.");
  return dateOrUndefined;
}

export const dobSchema = z
  .string()
  .refine(isValidISODate, { message: "Invalid date of birth" })
  .refine(validateIsPastOrPresentSafe, { message: "Date of birth can't be in the future" });
