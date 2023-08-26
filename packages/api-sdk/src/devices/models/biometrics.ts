import { BloodGlucose } from "./common/blood-glucose";
import { BloodPressure } from "./common/blood-pressure";
import { HeartRate } from "./common/heart-rate";
import { HeartRateVariability } from "./common/heart-rate-variability";
import { Respiration } from "./common/respiration";
import { Temperature } from "./common/temperature";
import { MetriportData } from "./metriport-data";

export interface Biometrics extends MetriportData {
  blood_glucose?: BloodGlucose;
  blood_pressure?: BloodPressure;
  heart_rate?: HeartRate;
  hrv?: HeartRateVariability;
  perfusion_index_pct?: number;
  respiration?: Respiration;
  temperature?: Temperature;
  // todo: ecg?
}
