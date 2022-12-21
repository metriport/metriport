import { Sample } from "./sample";

export interface HeartRateVariability {
  rmssd?: {
    avg_millis?: number;
    samples_millis?: Sample[];
  };
  sdnn?: {
    avg_millis?: number;
    samples_millis?: Sample[];
  };
}
