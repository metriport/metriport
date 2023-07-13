import { z } from "zod";

// https://developer.withings.com/api-reference/#operation/heartv2-list
export const withingsHeartRateResp = z.array(
  z.object({
    deviceid: z.string().optional().nullable(),
    model: z.number().optional().nullable(),
    ecg: z.object({ signalid: z.number(), afib: z.number() }).optional(),
    bloodpressure: z.object({ diastole: z.number(), systole: z.number() }).optional(),
    heart_rate: z.number(),
    timestamp: z.number(),
    timezone: z.string().optional(),
  })
);

export type WithingsHeartRate = z.infer<typeof withingsHeartRateResp>;
