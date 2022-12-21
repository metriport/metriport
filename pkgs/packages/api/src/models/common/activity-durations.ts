export interface ActivityDurations {
  active_seconds?: number;
  // also referred to as metabolic-equivalent minutes
  intensity?: {
    rest_seconds?: number;
    very_low_seconds?: number;
    low_seconds?: number;
    med_seconds?: number;
    high_seconds?: number;
  };
  // also referred to as stress
  strain?: {
    rest_seconds?: number;
    very_low_seconds?: number;
    low_seconds?: number;
    med_seconds?: number;
    high_seconds?: number;
    very_high_seconds?: number;
  };
}
