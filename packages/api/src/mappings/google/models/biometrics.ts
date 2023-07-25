import { z } from "zod";
import { googleResp } from ".";

export const sourceIdBloodGlucose =
  "derived:com.google.blood_glucose:com.google.android.gms:merged";
export const sourceIdBloodPressure =
  "derived:com.google.blood_pressure:com.google.android.gms:merged";
export const sourceIdBodyTemp = "derived:com.google.body.temperature:com.google.android.gms:merged";
export const sourceIdOxygenSat =
  "derived:com.google.oxygen_saturation:com.google.android.gms:merged";
export const sourceIdHeartBpm =
  "derived:com.google.heart_rate.bpm:com.google.android.gms:merge_heart_rate_bpm";

export const googleBiometricsDataSourceId = z.enum([
  sourceIdBloodGlucose,
  sourceIdBloodPressure,
  sourceIdBodyTemp,
  sourceIdOxygenSat,
  sourceIdHeartBpm,
]);

export const googleBiometricsResp = googleResp(googleBiometricsDataSourceId);

export type GoogleBiometrics = z.infer<typeof googleBiometricsResp>;
export type GoogleBiometricsDataSourceId = z.infer<typeof googleBiometricsDataSourceId>;
