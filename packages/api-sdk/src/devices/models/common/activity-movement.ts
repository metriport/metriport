export interface ActivityMovement {
  steps_count?: number;
  floors_count?: number;
  elevation?: {
    gain_meters?: number;
    min_meters?: number;
    max_meters?: number;
  };
  speed?: {
    max_km_h?: number;
    avg_km_h?: number;
  };
  avg_cadence?: number;
  distance_meters?: number;
}
