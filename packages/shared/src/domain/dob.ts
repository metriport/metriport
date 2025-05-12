import { buildDayjs, ISO_DATE, validateDateOfBirthSafe } from "../common/date";
import { BadRequestError } from "../error/bad-request";

export function normalizeDobSafe(date: string): string | undefined {
  const trimmedDate = date.trim();
  if (trimmedDate.length < 1) return undefined;
  if (!validateDateOfBirthSafe(trimmedDate)) {
    throw new BadRequestError("Invalid date of birth.", undefined, { date });
  }
  return buildDayjs(trimmedDate).format(ISO_DATE);
}

export function normalizeDob(date: string): string {
  const dateOrUndefined = normalizeDobSafe(date);
  if (!dateOrUndefined) throw new BadRequestError("Invalid date of birth.", undefined, { date });
  return dateOrUndefined;
}
