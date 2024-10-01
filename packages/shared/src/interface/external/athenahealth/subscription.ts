import { z } from "zod";

export type FeedType = "appointments";

export const subscriptionCreateResponseSchema = z.object({
  success: z.string(),
});
