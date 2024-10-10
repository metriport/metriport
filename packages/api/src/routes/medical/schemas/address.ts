import { usStateSchema, usTerritorySchema } from "@metriport/api-sdk/medical/models/common/us-data";
import { z } from "zod";
import { defaultOptionalString, defaultZipString } from "./shared";

export const usStateForAddressSchema = usStateSchema.or(usTerritorySchema);

export const addressSchema = z.object({
  addressLine1: defaultOptionalString,
  addressLine2: defaultOptionalString,
  city: defaultOptionalString,
  state: usStateForAddressSchema.or(defaultOptionalString),
  zip: defaultZipString,
  country: z.literal("USA").optional().default("USA"), // here for backwards compatibility, we'll ignore this and always default to USA
});

export const addressStrictSchema = z.object({
  addressLine1: z.string().min(1),
  addressLine2: defaultOptionalString,
  city: z.string().min(1),
  state: usStateForAddressSchema,
  zip: defaultZipString,
  country: z.literal("USA").default("USA"),
});
