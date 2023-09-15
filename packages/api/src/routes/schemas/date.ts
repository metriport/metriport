import { z } from "zod";
import { isValidISODate } from "../../shared/date";

const isValidISODateOptional = (date: string | undefined | null): boolean =>
  date ? isValidISODate(date) : true;

export const optionalDateSchema = z
  .string()
  .trim()
  .nullish()
  .refine(isValidISODateOptional, { message: "Invalid ISO date" });
