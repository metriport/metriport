import { z } from "zod";
import { usStateSchema } from "./us-data";

export const addressSchema = z.object({
  addressLine1: z.string().min(1),
  addressLine2: z.string().optional().nullable(),
  city: z.string().min(1),
  state: usStateSchema,
  zip: z.string().length(5),
  country: z.string().min(1),
});

export type Address = z.infer<typeof addressSchema>;
