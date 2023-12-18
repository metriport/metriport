import { z } from "zod";
import { usStateSchema } from "@metriport/api-sdk/medical/models/common/us-data";
import { defaultOptionalString, defaultZipString } from "./shared";

export const addressSchema = z.object({
  addressLine1: defaultOptionalString,
  addressLine2: defaultOptionalString,
  city: defaultOptionalString,
  state: usStateSchema.or(defaultOptionalString),
  zip: defaultZipString,
  country: z.literal("USA").optional().default("USA"), // here for backwards compatibility, we'll ignore this and always default to USA
});

export const AddressStrictSchema = z.object({
  addressLine1: z.string().min(1),
  addressLine2: defaultOptionalString,
  city: z.string().min(1),
  state: usStateSchema,
  zip: defaultZipString,
  country: z.literal("USA").default("USA"),
});
