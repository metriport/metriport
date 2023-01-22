import { z } from "zod"
import { googleResp } from ".";

export const googleSleepDataSourceId = z.enum([
  "derived:com.google.sleep.segment:com.google.android.gms:merged",
]);

export const googleSleepResp = googleResp(googleSleepDataSourceId)


export type GoogleSleep = z.infer<typeof googleSleepResp>;
export type GoogleSleepDataSourceId = z.infer<typeof googleSleepDataSourceId>;

