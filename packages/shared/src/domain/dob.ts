import { ISO_DATE } from "../common/date";
import dayjs from "dayjs";

export function normalizeDateSafe(date: string): string | undefined {
  const trimmedDate = date.trim();
  const parsedDate = dayjs(trimmedDate);
  if (!parsedDate.isValid()) return undefined;
  // TODO Check if date is in future
  return parsedDate.format(ISO_DATE);
}

export function normalizeDate(date: string): string {
  const dateOrUndefined = normalizeDateSafe(date);
  if (!dateOrUndefined) throw new Error("Invalid date.");
  return dateOrUndefined;
}
