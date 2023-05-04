import { z } from "zod";
import { USState } from "../../../shared/geographic-locations";
import { defaultOptionalString, parseToNumericString } from "./shared";

export const usStateSchema = z.nativeEnum(USState);

const zipLength = 5;
export const addressSchema = z.object({
  addressLine1: defaultOptionalString,
  addressLine2: defaultOptionalString,
  city: defaultOptionalString,
  state: usStateSchema.or(defaultOptionalString),
  zip: z.coerce
    .string()
    .transform(zipStr => parseToNumericString(zipStr))
    .refine(zip => zip.length === zipLength, {
      message: `Zip must be a string consisting of ${zipLength} numbers`,
    }),
  country: defaultOptionalString.default("USA"), // here for backwards compatibility, we'll ignore this and always default to USA
});
