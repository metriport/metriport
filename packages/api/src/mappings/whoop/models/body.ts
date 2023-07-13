import { z } from "zod";

// Data retrieved from https://developer.whoop.com/api/#tag/User
export const whoopBodyResp = z.object({
  height_meter: z.number(),
  weight_kilogram: z.number(),
  max_heart_rate: z.number(),
});

export type WhoopBody = z.infer<typeof whoopBodyResp>;
