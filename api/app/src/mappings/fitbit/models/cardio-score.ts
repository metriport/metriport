import { z } from "zod";

// https://dev.fitbit.com/build/reference/web-api/cardio-fitness-score/get-vo2max-summary-by-date/
export const fitbitCardioScoreResp = z
  .object({
    dateTime: z.string(),
    value: z.object({
      vo2Max: z.string(),
    }),
  })
  .optional();

export type FitbitCardioScore = z.infer<typeof fitbitCardioScoreResp>;
