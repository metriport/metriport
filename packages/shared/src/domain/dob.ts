import { ISO_DATE, buildDayjs } from "../common/date";
import dayjs from "dayjs";

export function normalizeDateSafe(date: string, afterDate?: dayjs.Dayjs): string | undefined {
  const trimmedDate = date.trim();
  const parsedDate = buildDayjs(trimmedDate);
  if (!parsedDate.isValid()) return undefined;
  if (afterDate && parsedDate < afterDate) return undefined;
  return parsedDate.format(ISO_DATE);
}

export function normalizeDate(date: string): string {
  const dateOrUndefined = normalizeDateSafe(date);
  if (!dateOrUndefined) throw new Error("Invalid date.");
  return dateOrUndefined;
}
