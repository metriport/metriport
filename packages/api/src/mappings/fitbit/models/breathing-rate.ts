import { z } from "zod";

// https://dev.fitbit.com/build/reference/web-api/breathing-rate/get-br-summary-by-date/
export const fitbitBreathingRateResp = z
  .object({
    dateTime: z.string(),
    breathingRate: z.number().nullable().optional(),
  })
  .optional();

export type FitbitBreathingRate = z.infer<typeof fitbitBreathingRateResp>;
