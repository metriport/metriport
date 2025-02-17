import { buildDayjs, ISO_DATE, validateDateOfBirth } from "../common/date";

export function normalizeDobSafe(date: string): string | undefined {
  const trimmedDate = date.trim();
  if (trimmedDate.length < 1) return undefined;
  if (!validateDateOfBirth(trimmedDate)) throw new Error("Invalid date of birth.");
  return buildDayjs(trimmedDate).format(ISO_DATE);
}

export function normalizeDob(date: string): string {
  const dateOrUndefined = normalizeDobSafe(date);
  if (!dateOrUndefined) throw new Error("Invalid date of birth.");
  return dateOrUndefined;
}
