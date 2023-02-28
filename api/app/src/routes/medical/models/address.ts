import { z } from "zod";
export const addressSchema = z.object({
  address1: z.string().min(1),
  address2: z.string().optional(),
  city: z.string().min(1),
  state: z.string().min(1),
  postalCode: z.string().length(5),
  country: z.string().min(1).default("USA"),
});
