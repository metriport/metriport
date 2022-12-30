import { Sample } from "./sample";

export interface Respiration {
  vo2_max?: number;
  spo2?: {  // blood oxygen
    min_pct?: number;
    max_pct?: number;
    avg_pct?: number;
  };
  avg_breaths_per_minute?: number;
  /**
   * Samples of respiration readings, breaths per minute over time.
   */
  samples_breaths_per_minute?: Sample[];
}
