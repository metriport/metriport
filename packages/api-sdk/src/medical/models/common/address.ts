import {
  defaultOptionalStringSchema,
  defaultStringSchema,
  stripNonNumericChars,
} from "@metriport/shared";
import { z } from "zod";
import { usStateSchema, usTerritorySchema } from "./us-data";

const zipLength = 5;

export const geoCoordinateSchema = z.object({
  lat: z.number(),
  lon: z.number(),
});

export const usStateForAddressSchema = usStateSchema.or(usTerritorySchema);

export const addressSchema = z.object({
  addressLine1: defaultStringSchema.min(1, { message: "Address line must be specified." }),
  addressLine2: defaultOptionalStringSchema,
  city: defaultStringSchema.min(1, { message: "City must be specified." }),
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
