import { z } from "zod";

// https://dev.fitbit.com/build/reference/web-api/heartrate-timeseries/get-heartrate-timeseries-by-date/
export const fitbitHeartRateResp = z
  .object({
    dateTime: z.string(),
    value: z.object({
      customHeartRateZones: z
        .array(
          z.object({
            caloriesOut: z.number().nullish(),
            max: z.number().nullish(),
            min: z.number().nullish(),
            minutes: z.number().nullish(),
            name: z.string().nullish(),
          })
        )
        .optional(),
      heartRateZones: z.array(
        z.object({
          caloriesOut: z.number().nullish(),
          max: z.number().nullish(),
          min: z.number().nullish(),
          minutes: z.number().nullish(),
          name: z.string().nullish(),
        })
      ),
      restingHeartRate: z.number().nullish(),
    }),
  })
  .optional();

export type FitbitHeartRate = z.infer<typeof fitbitHeartRateResp>;
