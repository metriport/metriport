import { Sample } from "./sample";

export interface BloodGlucose {
  avg_mg_dL?: number;
  samples_mg_dL: Sample[];
}
