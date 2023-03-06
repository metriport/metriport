import { z } from "zod";
import { optionalString } from "./shared";

export const addressSchema = z.object({
  addressLine1: z.string().min(1),
  addressLine2: optionalString(z.string()),
  city: z.string().min(1),
  state: z.string().min(1),
  zip: z.string().length(5),
  country: z.string().min(1).default("USA"),
});
