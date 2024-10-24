import {
  stripNonNumericChars,
  geoCoordinateSchema,
  usStateForAddressSchema,
} from "@metriport/shared";
import { z } from "zod";
import { defaultOptionalString, defaultString } from "../../../shared";

const zipLength = 5;

export const addressSchema = z.object({
  addressLine1: defaultString.min(1, { message: "Address line must be specified." }),
  addressLine2: defaultOptionalString,
  city: defaultString.min(1, { message: "City must be specified." }),
  state: usStateForAddressSchema,
  zip: z.coerce
    .string()
    .transform(zipStr => stripNonNumericChars(zipStr))
    .refine(zip => zip.length === zipLength, {
      message: `Zip must be a string consisting of ${zipLength} numbers.`,
    }),
  coordinates: geoCoordinateSchema.optional(),
  country: z.literal("USA").optional().default("USA"),
});

export type Address = z.infer<typeof addressSchema>;
