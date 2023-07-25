import { z } from "zod";

// https://dev.fitbit.com/build/reference/web-api/temperature/get-temperature-core-summary-by-date
export const fitbitTempCoreResp = z
  .object({
    dateTime: z.string(),
    value: z.number().nullable(),
  })
  .optional();

export type FitbitTempCore = z.infer<typeof fitbitTempCoreResp>;
