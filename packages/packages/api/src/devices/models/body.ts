import { MetriportData } from "./metriport-data";

export interface Body extends MetriportData {
  body_fat_pct?: number;
  height_cm?: number;
  weight_kg?: number;
  bone_mass_kg?: number;
  muscle_mass_kg?: number;
  lean_mass_kg?: number;
  max_possible_heart_rate_bpm?: number;
}
