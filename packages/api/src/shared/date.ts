import { BadRequestError } from "@metriport/shared";
import {
  ISO_DATE_TIME,
  isValidISODateTime,
  isValidISODate as isValidISODateShared,
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

export function parseISODate(date?: string): string | undefined {
  if (date && !isValidISODate(date)) {
    throw new BadRequestError(`Date must be in format ${ISO_DATE} - got ${date}`);
  }
  return date;
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
