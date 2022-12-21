import { ActivityDurations } from "./activity-durations";
import { ActivityMovement } from "./activity-movement";
import { EnergyExpenditure } from "./energy-expenditure";
import { HeartRate } from "./heart-rate";
import { HeartRateVariability } from "./heart-rate-variability";
import { LatLon } from "./lat-lon";
import { Metadata } from "./metadata";
import { Respiration } from "./respiration";

export interface ActivityLog {
  metadata: Metadata;
  name?: string;
  type?: string;
  start_time?: string;
  end_time?: string;
  durations?: ActivityDurations;
  energy_expenditure?: EnergyExpenditure;
  movement?: ActivityMovement;
  location?: {
    start_lat_lon_deg?: LatLon;
    end_lat_lon_deg?: LatLon;
    polystring?: string;
    city?: string;
    country?: string;
    region?: string; // can be state, province, etc.
  };
  biometrics?: {
    heart_rate?: HeartRate;
    hrv?: HeartRateVariability;
    respiration?: Respiration;
  };
  // todo: laps + more time samples thoughout the models?
}
