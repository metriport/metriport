import { z } from "zod";
import { usStateSchema } from "./us-data";
import { defaultOptionalString, stripNonNumericChars } from "../../../shared";

const zipLength = 5;
export const addressSchema = z.object({
  addressLine1: defaultOptionalString,
  addressLine2: defaultOptionalString,
  city: defaultOptionalString,
  state: usStateSchema.or(defaultOptionalString),
  zip: z.coerce
    .string()
    .transform(zipStr => stripNonNumericChars(zipStr))
    .refine(zip => zip.length === zipLength, {
      message: `Zip must be a string consisting of ${zipLength} numbers`,
    }),
  country: defaultOptionalString.default("USA"), // here for backwards compatibility, we'll ignore this and always default to USA
});

export type Address = z.infer<typeof addressSchema>;
