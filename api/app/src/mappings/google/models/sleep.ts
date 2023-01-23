import { z } from "zod"
import { googleResp } from ".";

export const sourceIdSleep = "derived:com.google.sleep.segment:com.google.android.gms:merged";

export const googleSleepDataSourceId = z.enum([
  sourceIdSleep,
]);

export const googleSleepResp = googleResp(googleSleepDataSourceId)


export type GoogleSleep = z.infer<typeof googleSleepResp>;
export type GoogleSleepDataSourceId = z.infer<typeof googleSleepDataSourceId>;

