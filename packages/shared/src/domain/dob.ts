import { z } from "zod";
import { BadRequestError } from "../error/bad-request";
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
  if (validateIsPastOrPresentSafe && !validateIsPastOrPresentSafe(date)) return undefined;
  return parsedDate.format(ISO_DATE);
}

export function normalizeDate(
  date: string,
  validateIsPastOrPresentSafe: ((date: string) => boolean) | undefined = undefined
): string {
  const dateOrUndefined = normalizeDateSafe(date, validateIsPastOrPresentSafe);
  if (!dateOrUndefined) {
    throw new BadRequestError("Invalid date", undefined, { date });
  }
  return dateOrUndefined;
}

export const dobSchema = z.coerce
  .string()
  .refine(normalizeDateSafe, { message: "Invalid date of birth" })
  .transform(dob => normalizeDate(dob))
  .refine(validateIsPastOrPresentSafe, { message: "Date of birth can't be in the future" });
