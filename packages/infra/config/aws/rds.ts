export type RDSConfig = {
  /**
   * The name of the database.
   */
  name: string;
  /**
   * The API username to connect to the database.
   */
  username: string;
  /**
   * From CDK: A preferred maintenance window day/time range. Should be specified as a range ddd:hh24:mi-ddd:hh24:mi (24H Clock UTC).
   *
   * Example: 'Sun:23:45-Mon:00:15'.
   *
   * Must be at least 30 minutes long.
   *
   * @see: https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/USER_UpgradeDBInstance.Maintenance.html#Concepts.DBMaintenance
   */
  maintenanceWindow: string;
  /**
   * From CDK: The minimum number of Aurora capacity units (ACUs) for a DB instance in an Aurora Serverless v2 cluster.
   *
   * You can specify ACU values in half-step increments, such as 8, 8.5, 9, and so on. The smallest value that you can use is 0.5.
   *
   * @see — http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-rds-dbcluster-serverlessv2scalingconfiguration.html#cfn-rds-dbcluster-serverlessv2scalingconfiguration-mincapacity
   */
  minCapacity: number;
  /**
   * From CDK: The maximum number of Aurora capacity units (ACUs) for a DB instance in an Aurora Serverless v2 cluster.
   *
   * You can specify ACU values in half-step increments, such as 40, 40.5, 41, and so on. The largest value that you can use is 128.
   *
   * The maximum capacity must be higher than 0.5 ACUs. For more information, see Choosing the maximum Aurora Serverless v2 capacity setting for a cluster in the Amazon Aurora User Guide.
   *
   * @see — http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-rds-dbcluster-serverlessv2scalingconfiguration.html#cfn-rds-dbcluster-serverlessv2scalingconfiguration-maxcapacity
   */
  maxCapacity: number;
  /**
   * The minimum duration in milliseconds for a slow log to be recorded.
   *
   * If not present, slow logs will not be recorded.
   *
   * @see: https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/AuroraPostgreSQL.Reference.ParameterGroups.html#AuroraPostgreSQL.Reference.Parameters.Cluster
   */
  minSlowLogDurationInMs?: number;
  /**
   * The thresholds for the RDS alarms.
   */
  alarmThresholds: RDSAlarmThresholds;
};

export type RDSConfigExtended = RDSConfig;

export type RDSAlarmThresholds = {
  acuUtilizationPct: number;
  cpuUtilizationPct: number;
  freeableMemoryMb: number;
  volumeReadIops: number;
  volumeWriteIops: number;
  /**
   * The amount of available storage in MB. Defaults to 10GB.
   */
  freeLocalStorageMb?: number;
};
