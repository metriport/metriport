import { z } from "zod";

// https://dev.fitbit.com/build/reference/web-api/heartrate-timeseries/get-heartrate-timeseries-by-date/
export const fitbitHeartRateResp = z
  .object({
    dateTime: z.string(),
    value: z.object({
      customHeartRateZones: z
        .array(
          z.object({
            caloriesOut: z.number(),
            max: z.number(),
            min: z.number(),
            minutes: z.number(),
            name: z.string(),
          })
        )
        .optional(),
      heartRateZones: z.array(
        z.object({
          caloriesOut: z.number(),
          max: z.number(),
          min: z.number(),
          minutes: z.number(),
          name: z.string(),
        })
      ),
      restingHeartRate: z.number().nullable(),
    }),
  })
  .optional();

export type FitbitHeartRate = z.infer<typeof fitbitHeartRateResp>;
