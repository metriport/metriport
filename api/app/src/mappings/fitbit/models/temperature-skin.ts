import { z } from "zod";

// https://dev.fitbit.com/build/reference/web-api/temperature/get-temperature-skin-summary-by-date/
export const fitbitTempSkinResp = z
  .object({
    dateTime: z.string(),
    value: z.object({ nightlyRelative: z.number().nullable() }),
    logType: z.string(),
  })
  .optional();

export type FitbitTempSkin = z.infer<typeof fitbitTempSkinResp>;
