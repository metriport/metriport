export type RDSAlarmThresholds = {
  acuUtilizationPct: number;
  cpuUtilizationPct: number;
  freeableMemoryMb: number;
  volumeReadIops: number;
  volumeWriteIops: number;
  /**
   * Threshold for database connections count
   */
  databaseConnectionsCount: number;
  /**
   * The amount of available storage in MB. Defaults to 10GB.
   */
  freeLocalStorageMb?: number;
};
