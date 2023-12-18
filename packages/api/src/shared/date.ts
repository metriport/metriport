import dayjs from "dayjs";
import BadRequestError from "../errors/bad-request";

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

/**
 * @deprecated Use @metriport/shared instead
 */
export function isValidISODate(date: string): boolean {
  return dayjs(date, ISO_DATE, true).isValid();
}
