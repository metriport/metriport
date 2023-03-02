import { z } from "zod";

export const addressSchema = z.object({
  addressLine1: z.string().min(1),
  addressLine2: z.string().optional(),
  city: z.string().min(1),
  state: z.string().min(1),
  zip: z.string().length(5),
  country: z.string().min(1).default("USA"),
});
