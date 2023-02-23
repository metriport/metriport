import { Sample } from "./sample";

export interface BloodPressure {
  diastolic_mm_Hg?: {
    samples?: Sample[];
  };
  systolic_mm_Hg?: {
    samples?: Sample[];
  };
}
