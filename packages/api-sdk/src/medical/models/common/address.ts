import { z } from "zod";
import { usStateSchema } from "./us-data";
import { defaultOptionalString, defaultString, stripNonNumericChars } from "../../../shared";

const zipLength = 5;
export const addressSchema = z.object({
  addressLine1: defaultString.min(1, { message: "Address line must be specified." }),
  addressLine2: defaultOptionalString,
  city: defaultString.min(1, { message: "City must be specified." }),
  state: usStateSchema.or(defaultString),
  zip: z.coerce
    .string()
    .transform(zipStr => stripNonNumericChars(zipStr))
    .refine(zip => zip.length === zipLength, {
      message: `Zip must be a string consisting of ${zipLength} numbers.`,
    }),
  country: defaultOptionalString.default("USA"), // here for backwards compatibility, we'll ignore this and always default to USA
});

export type Address = z.infer<typeof addressSchema>;
