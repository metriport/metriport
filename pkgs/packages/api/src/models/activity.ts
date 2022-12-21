import { ActivityDurations } from "./common/activity-durations";
import { ActivityLog } from "./common/activity-log";
import { ActivityMovement } from "./common/activity-movement";
import { EnergyExpenditure } from "./common/energy-expenditure";
import { HeartRate } from "./common/heart-rate";
import { HeartRateVariability } from "./common/heart-rate-variability";
import { Respiration } from "./common/respiration";
import { MetriportData } from "./metriport-data";

export interface Activity extends MetriportData {
  summary?: {
    durations?: ActivityDurations;
    energy_expenditure?: EnergyExpenditure;
    movement?: ActivityMovement;
    biometrics?: {
      heart_rate?: HeartRate;
      hrv?: HeartRateVariability;
      respiration?: Respiration;
    };
  };
  activity_logs?: ActivityLog[];
}
