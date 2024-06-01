import dayjs from "dayjs";
import { CustomErrorParams, z } from "zod";

export const ISO_DATE = "YYYY-MM-DD";

export function isValidISODate(date: string): boolean {
  return dayjs(date, ISO_DATE, true).isValid();
}

const isValidISODateOptional = (date: string | undefined | null): boolean =>
  date ? isValidISODate(date) : true;

const invalidIsoMsg: CustomErrorParams = { message: "Invalid ISO date" };

export const optionalDateSchema = z
  .string()
  .trim()
  .nullish()
  .refine(isValidISODateOptional, invalidIsoMsg);

export const dateSchema = z.string().trim().refine(isValidISODate, invalidIsoMsg);

export const elapsedTimeFromNow = (
  date?: Date,
  format: dayjs.UnitTypeLong = "millisecond"
): number => {
  return dayjs().diff(dayjs(date), format);
};
