import { z } from "zod";

// https://developer.withings.com/api-reference#operation/measurev2-getactivity
export const withingsActivityLogResp = z.array(
  z.object({
    date: z.string(),
    timezone: z.string().optional().nullable(),
    deviceid: z.string().nullable(),
    hash_deviceid: z.string().nullable(),
    brand: z.number().optional().nullable(),
    is_tracker: z.boolean().optional().nullable(),
    steps: z.number(),
    distance: z.number(),
    elevation: z.number(),
    soft: z.number(),
    moderate: z.number(),
    intense: z.number(),
    active: z.number(),
    calories: z.number(),
    totalcalories: z.number(),
    hr_average: z.number().optional().nullable(),
    hr_min: z.number().optional().nullable(),
    hr_max: z.number().optional().nullable(),
    hr_zone_0: z.number().optional().nullable(),
    hr_zone_1: z.number().optional().nullable(),
    hr_zone_2: z.number().optional().nullable(),
    hr_zone_3: z.number().optional().nullable(),
  })
);

export type WithingsActivityLogs = z.infer<typeof withingsActivityLogResp>;
