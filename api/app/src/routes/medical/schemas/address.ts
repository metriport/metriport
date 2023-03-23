import { z } from "zod";
import { optionalString } from "./shared";

export const addressSchema = z.object({
  addressLine1: z.string(),
  addressLine2: optionalString(z.string()),
  city: z.string(),
  state: z.string(),
  zip: z.string().length(5),
  country: z.string().default("USA"),
});
