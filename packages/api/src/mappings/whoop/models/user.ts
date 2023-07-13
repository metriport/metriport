import { z } from "zod";

// Data retrieved from https://developer.whoop.com/docs/developing/user-data/user
export const whoopUserResp = z.object({
  user_id: z.number(),
  email: z.string(),
  first_name: z.string(),
  last_name: z.string(),
});

export type WhoopUser = z.infer<typeof whoopUserResp>;
