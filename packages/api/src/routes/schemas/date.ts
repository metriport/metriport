import { z } from "zod";
import { isValidISODate } from "../../shared/date";

const isValidISODateOptional = (date: string | undefined | null): boolean =>
  date ? isValidISODate(date) : true;

/**
 * @deprecated Use @metriport/shared instead
 */
export const optionalDateSchema = z
  .string()
  .trim()
  .nullish()
  .refine(isValidISODateOptional, { message: "Invalid ISO date" });
