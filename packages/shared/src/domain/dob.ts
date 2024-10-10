import { ISO_DATE, buildDayjs } from "../common/date";
import dayjs from "dayjs";

function noramlizeDateBase(date: string): string {
  return date.trim();
}

export function normalizeDateSafe(
  date: string,
  normalizeBase: (date: string) => string = noramlizeDateBase,
  afterDate?: dayjs.Dayjs
): string | undefined {
  const baseDate = normalizeBase(date);
  const parsedDate = buildDayjs(baseDate);
  if (!parsedDate.isValid()) return undefined;
  if (afterDate && parsedDate < afterDate) return undefined;
  return parsedDate.format(ISO_DATE);
}

export function normalizeDate(date: string): string {
  const dateOrUndefined = normalizeDateSafe(date);
  if (!dateOrUndefined) throw new Error("Invalid date.");
  return dateOrUndefined;
}
