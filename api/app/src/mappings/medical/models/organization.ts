import { z } from "zod";
import { addressSchema } from "./address";

export const organizationSchema = z.object({
  id: z.string().optional().nullable(),
  name: z.string().min(1),
  locations: z.array(addressSchema),
});
