import { z } from "zod";

export const clientKeySchema = z.object({
  clientKey: z.string(),
  clientSecret: z.string(),
});
