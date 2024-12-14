import { z } from "zod";
import { usStateSchema } from "@metriport/api-sdk/medical/models/common/us-data";
import { defaultOptionalString, defaultZipString } from "./shared";

export const addressStrictSchema = z.object({
  addressLine1: z.string().min(1),
  addressLine2: defaultOptionalString,
  city: z.string().min(1),
  state: usStateSchema,
  zip: defaultZipString,
  country: z.literal("USA").default("USA"),
});
