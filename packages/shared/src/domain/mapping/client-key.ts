import { z } from "zod";

export const clientKeySchema = z.object({
  cxId: z.string(),
  clientKey: z.string(),
  clientSecret: z.string(),
});
