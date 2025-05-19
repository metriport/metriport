import { buildDayjs, ISO_DATE, validateDateOfBirth } from "../common/date";
import { BadRequestError } from "../error/bad-request";

/**
 * TODO Consider renaming this function to parseDobSafe
 * - normalize: make all dates the same format
 * - parse: try to convert the value to date
 *   - return undefined (or throw) if it's invalid
 *   - normalize it and return the result
 */
export function normalizeDobSafe(date: string): string | undefined {
  const trimmedDate = date.trim();
  if (trimmedDate.length < 1) return undefined;
  if (!validateDateOfBirth(trimmedDate)) return undefined;
  return buildDayjs(trimmedDate).format(ISO_DATE);
}

export function normalizeDob(date: string): string {
  const dateOrUndefined = normalizeDobSafe(date);
  if (!dateOrUndefined) throw new BadRequestError("Invalid date of birth", undefined, { date });
  return dateOrUndefined;
}
