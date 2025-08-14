import {
  usStateSchema,
  usTerritorySchema,
  usZipSchema,
} from "@metriport/api-sdk/medical/models/common/us-data";
import { defaultOptionalStringSchema } from "@metriport/shared";
import { z } from "zod";

export const usStateForAddressSchema = usStateSchema.or(usTerritorySchema);

export const addressSchema = z.object({
  addressLine1: defaultOptionalStringSchema,
  addressLine2: defaultOptionalStringSchema,
  city: defaultOptionalStringSchema,
  state: usStateForAddressSchema.or(defaultOptionalStringSchema),
  zip: usZipSchema.or(defaultOptionalStringSchema),
  country: z.literal("USA").optional().default("USA"), // here for backwards compatibility, we'll ignore this and always default to USA
});

export const addressStrictSchema = z.object({
  addressLine1: z.string().min(1),
  addressLine2: defaultOptionalStringSchema,
  city: z.string().min(1),
  state: usStateForAddressSchema,
  zip: usZipSchema,
  country: z.literal("USA").default("USA"),
});
