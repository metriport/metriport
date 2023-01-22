import { z } from "zod"
import { googleResp } from ".";

export const googleBiometricsDataSourceId = z.enum([
  "derived:com.google.blood_pressure:com.google.android.gms:merged",
  "derived:com.google.blood_glucose:com.google.android.gms:merged",
  "derived:com.google.body.temperature:com.google.android.gms:merged",
  "derived:com.google.oxygen_saturation:com.google.android.gms:merged",
  "derived:com.google.heart_rate.bpm:com.google.android.gms:merge_heart_rate_bpm",
]);

export const googleBiometricsResp = googleResp(googleBiometricsDataSourceId)

export type GoogleBiometrics = z.infer<typeof googleBiometricsResp>;
export type GoogleBiometricsDataSourceId = z.infer<typeof googleBiometricsDataSourceId>;

