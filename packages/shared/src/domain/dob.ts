import { z } from "zod";
import { buildDayjs, ISO_DATE, validateIsPastOrPresentSafe } from "../common/date";

function noramlizeDateBase(date: string): string {
  return date.trim();
}

export function normalizeDateSafe(
  date: string,
  validateIsPastOrPresentSafe: ((date: string) => boolean) | undefined = undefined,
  normalizeBase: (date: string) => string = noramlizeDateBase
): string | undefined {
  const baseDate = normalizeBase(date);
  const parsedDate = buildDayjs(baseDate);
  if (!parsedDate.isValid()) return undefined;
  if (validateIsPastOrPresentSafe) {
    if (!validateIsPastOrPresentSafe(date)) return undefined;
  }
  return parsedDate.format(ISO_DATE);
}

export function normalizeDate(
  date: string,
  validateIsPastOrPresentSafe: ((date: string) => boolean) | undefined = undefined,
  normalizeBase: (date: string) => string = noramlizeDateBase
): string {
  const dateOrUndefined = normalizeDateSafe(date, validateIsPastOrPresentSafe, normalizeBase);
  if (!dateOrUndefined) throw new Error("Invalid date.");
  return dateOrUndefined;
}

export const dobSchema = z.coerce
  .string()
  .refine(normalizeDateSafe, { message: "Invalid date of birth" })
  .transform(dob => normalizeDate(dob))
  .refine(validateIsPastOrPresentSafe, { message: "Date of birth can't be in the future" });
