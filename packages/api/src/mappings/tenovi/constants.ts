export const tenoviMetricTypes = [
  "blood_pressure",
  "pulse",
  "spO2",
  "perfusion_index",
  "weight",
  "temperature",
  "glucose",
  "blood_glucose",
  "peak_expiratory_flow",
  "forced_expiratory_volume",
  "battery_percentage",
] as const;

export type TenoviMetricTypes = (typeof tenoviMetricTypes)[number];
