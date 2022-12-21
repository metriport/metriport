import { Sample } from "./sample";

export interface HeartRate {
  min_bpm?: number;
  max_bpm?: number;
  avg_bpm?: number;
  resting_bpm?: number;
  samples_bpm?: Sample[];
}
