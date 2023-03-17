import { z } from "zod";
import { usStateSchema } from "./us-data";

export const addressSchema = z.object({
  addressLine1: z.string(),
  addressLine2: z.string().optional().nullable(),
  city: z.string(),
  state: usStateSchema,
  zip: z.string(),
  country: z.string(),
});

export type Address = z.infer<typeof addressSchema>;
