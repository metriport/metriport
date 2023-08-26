import { HeartRate } from "./common/heart-rate";
import { HeartRateVariability } from "./common/heart-rate-variability";
import { Respiration } from "./common/respiration";
import { Temperature } from "./common/temperature";
import { MetriportData } from "./metriport-data";

export interface Sleep extends MetriportData {
  start_time?: string;
  end_time?: string;
  durations?: SleepDurations;
  biometrics?: SleepBiometrics;
  wakeup_frequency?: number;
}
export interface SleepDurations {
  total_seconds?: number;
  awake_seconds?: number;
  deep_seconds?: number;
  rem_seconds?: number;
  light_seconds?: number;
  in_bed_seconds?: number;
  time_to_fall_asleep_seconds?: number;
  no_data_seconds?: number;
}
export interface SleepBiometrics {
  heart_rate?: HeartRate;
  hrv?: HeartRateVariability;
  respiration?: Respiration;
  temperature?: Temperature;
}
