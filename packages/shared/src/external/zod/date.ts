import { z } from "zod";
import {
  buildDayjs,
  ISO_DATE,
  isValidISODate,
  validateDateIsAfter1900,
  validateIsPastOrPresentSafe,
} from "../../common/date";
import { defaultStringSchema } from "./string";

export const ISO_DATE_REGEX =
  /(?:[1-9]\d{3}-(?:(?:0[1-9]|1[0-2])-(?:0[1-9]|1\d|2[0-8])|(?:0[13-9]|1[0-2])-(?:29|30)|(?:0[13578]|1[02])-31)|(?:[1-9]\d(?:0[48]|[2468][048]|[13579][26])|(?:[2468][048]|[13579][26])00)-02-29)/;

export const ISO_DATETIME_REGEX =
  /(?:[1-9]\d{3}-(?:(?:0[1-9]|1[0-2])-(?:0[1-9]|1\d|2[0-8])|(?:0[13-9]|1[0-2])-(?:29|30)|(?:0[13578]|1[02])-31)|(?:[1-9]\d(?:0[48]|[2468][048]|[13579][26])|(?:[2468][048]|[13579][26])00)-02-29)T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:Z|[+-][01]\d:[0-5]\d)/;

export const US_DATE_REGEX =
  /^(?:0[1-9]|1[0-2])\/(?:0[1-9]|1\d|2[0-8])\/(?:[1-9]\d{3})|(?:0[13-9]|1[0-2])\/(?:29|30)\/(?:[1-9]\d{3})|(?:0[13578]|1[02])\/31\/(?:[1-9]\d{3})|02\/29\/(?:(?:[1-9]\d(?:0[48]|[2468][048]|[13579][26]))|(?:[2468][048]|[13579][26])00)$/;

export const isoDateSchema = z.string().regex(ISO_DATE_REGEX, "date must be a valid ISO date");

export const isoDateTimeSchema = z
  .string()
  .regex(ISO_DATETIME_REGEX, "dateTime must be a valid ISO dateTime");

export const usDateSchema = z.string().regex(US_DATE_REGEX, "date must be a valid US date");

export const defaultDateStringSchema = defaultStringSchema.refine(isValidISODate, {
  message: `Date must be a valid ISO 8601 date formatted ${ISO_DATE}. Example: 2023-03-15`,
});

export const pastOrTodayDateStringSchema = defaultDateStringSchema.refine(
  validateIsPastOrPresentSafe,
  {
    message: `Date can't be in the future`,
  }
);

export const validDateOfBirthStringSchema = pastOrTodayDateStringSchema.refine(
  validateDateIsAfter1900,
  {
    message: `Date can't be before 1900`,
  }
);

export function dateStringToIsoDateString(date: string): string {
  return buildDayjs(date).toISOString();
}
