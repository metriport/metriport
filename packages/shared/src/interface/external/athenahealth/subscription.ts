import { z } from "zod";

export const subscriptionCreateResponseSchema = z.object({
  success: z.string(),
});
