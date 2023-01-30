import { z } from "zod";

import { addressSchema } from "./address";

export const facilitySchema = z.object({
  id: z.string().optional().nullable(),
  name: z.string().optional().nullable(),
  address: addressSchema.optional().nullable(),
});
