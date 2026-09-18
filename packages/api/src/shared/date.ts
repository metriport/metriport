import { BadRequestError } from "@metriport/shared";
import {
  ISO_DATE_TIME,
  isValidISODateTime,
  isValidISODate as isValidISODateShared,
  toIsoDate,
} from "@metriport/shared/common/date";
import dayjs from "dayjs";

export const ISO_DATE = "YYYY-MM-DD";

export const formatStartDate = (date: string): string => {
  return dayjs(date).toISOString();
};

export const formatEndDate = (date: string): string => {
  return dayjs(date).add(24, "hours").toISOString();
};

export const getStartAndEndDateTime = (date: string) => {
  return {
    start_date: dayjs(date).toISOString(),
    end_date: dayjs(date).add(24, "hours").toISOString(),
  };
};

export const getStartAndEndDate = (date: string) => {
  return {
    start_date: date,
    end_date: dayjs(date).add(24, "hours").format("YYYY-MM-DD"),
  };
};

export const secondsToISODate = (unixTime: number): string => {
  return dayjs.unix(unixTime).format(ISO_DATE);
};

export const secondsToISODateTime = (unixTime: number): string => {
  return dayjs.unix(unixTime).toISOString();
};

/**
 * Parses a query/body date field as `YYYY-MM-DD`.
 *
 * ISO dateTime values (e.g. `2024-06-01T11:14:17.452Z`) are accepted and
 * coerced to their calendar date so clients that send timestamps on date
 * filters don't get a 400.
 */
export function parseISODate(date?: string): string | undefined {
  if (date === undefined) return date;
  const normalized = toIsoDate(date);
  if (!normalized) {
    throw new BadRequestError(`Date must be in format ${ISO_DATE} - got ${date}`);
  }
  return normalized;
}

export function validateISODateOrDateTime(date?: string): string | undefined {
  if (!date) return undefined;
  if (date.length === 10 && isValidISODateShared(date)) return date;
  if (date.length === 24 && isValidISODateTime(date)) return date;
  throw new BadRequestError(`Date must be in format ${ISO_DATE} or ${ISO_DATE_TIME}`, undefined, {
    date,
  });
}

/**
 * @deprecated Use @metriport/shared instead
 */
export function isValidISODate(date: string): boolean {
  return isValidISODateShared(date);
}
