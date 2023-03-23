import { z } from "zod";
import { usStateSchema } from "./us-data";

export const addressSchema = z.object({
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional().nullable(),
  city: z.string().optional(),
  state: usStateSchema.optional(),
  zip: z.string(),
  country: z.string().optional(),
});

export type Address = z.infer<typeof addressSchema>;
