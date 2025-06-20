import { stripNonNumericChars } from "@metriport/shared";
import dayjs from "dayjs";
import { z, ZodString } from "zod";
import { ISO_DATE } from "../../../shared/date";

export const emptyStringToUndefined = (v: string | undefined | null) =>
  v == null || v.length < 1 ? undefined : v;

export const optionalString = (zodSchema: ZodString) =>
  zodSchema.or(z.string().optional()).transform(emptyStringToUndefined);

export const defaultString = z.string().trim();
export const defaultOptionalString = optionalString(defaultString);
export const defaultDateString = defaultString.refine(v => dayjs(v, ISO_DATE, true).isValid(), {
  message: `Date must be a valid ISO 8601 date formatted ${ISO_DATE}. Example: 2023-05-03`,
});
const zipLength = 5;
export const defaultZipString = z.coerce
  .string()
  .transform(zipStr => stripNonNumericChars(zipStr))
  .refine(zip => zip.length === zipLength, {
    message: `Zip must be a string consisting of ${zipLength} numbers`,
  });
export const defaultNameString = defaultString.min(1);

export const allOrSelectPatientIdsSchema = z.object({
  patientIds: z.array(z.string()).optional(),
  all: z.boolean().optional(),
});

export const allOrSelectPatientIdsRefinedSchema = allOrSelectPatientIdsSchema
  .refine(data => data.patientIds || data.all, {
    message: "Either patientIds or all must be provided",
  })
  .refine(data => !data.patientIds || data.patientIds.length > 0, {
    message: "patientIds must be an array of patient IDs",
  })
  .refine(data => !(data.patientIds && data.all), {
    message: "patientIds and all cannot be provided together",
  });
