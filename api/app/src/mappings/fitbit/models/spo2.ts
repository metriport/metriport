import { z } from "zod";

// https://dev.fitbit.com/build/reference/web-api/spo2/get-spo2-summary-by-date/
export const fitbitSpo2Resp = z.object({
  dateTime: z.string().optional(),
  value: z
    .object({
      avg: z.number().nullable().optional(),
      min: z.number().nullable().optional(),
      max: z.number().nullable().optional(),
    })
    .optional(),
});

export type FitbitSpo2 = z.infer<typeof fitbitSpo2Resp>;
