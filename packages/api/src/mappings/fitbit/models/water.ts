import { z } from "zod";

// https://dev.fitbit.com/build/reference/web-api/nutrition/get-water-log/
export const fitbitWaterResp = z.object({
  summary: z.object({ water: z.number() }),
  water: z.array(z.object({ amount: z.number(), logId: z.number() })),
});

export type FitbitWater = z.infer<typeof fitbitWaterResp>;
