import { z } from "zod";

// https://dev.fitbit.com/build/reference/web-api/heartrate-variability/get-hrv-summary-by-date/

export const fitbitHeartVariabilityResp = z
  .object({
    value: z.object({
      dailyRmssd: z.number().nullable(),
      deepRmssd: z.number().nullable(),
    }),
    dateTime: z.string(),
  })
  .optional();

export type FitbitHeartVariability = z.infer<typeof fitbitHeartVariabilityResp>;
