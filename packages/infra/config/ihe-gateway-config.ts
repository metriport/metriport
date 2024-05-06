import { Duration } from "aws-cdk-lib";
import { ECS_CPU, ECS_MEMORY } from "./aws/ecs";
import { RDSAlarmThresholds } from "./aws/rds";

export type IHEGatewayEcsProps = {
  // Watch out for the combination of vCPUs and memory, more vCPU requires more memory
  // https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_definition_parameters.html#task_size
  /**
   * Determines the valid CPU values.
   *
   * @see {@link ECS_MEMORY}
   * @see {@link https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_definition_parameters.html#task_size}
   */
  memory: ECS_MEMORY;
  /**
   * Determined by the memory value.
   *
   * @see {@link ECS_CPU}
   * @see {@link https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_definition_parameters.html#task_size}
   */
  cpu: ECS_CPU;
  /**
   * Minimum amount of tasks to run at all times.
   */
  minCapacity: number;
  /**
   * Maximum amount of tasks to run at all times.
   */
  maxCapacity: number;
  /**
   * How long a request can take before it is closed by the Load Balancer.
   */
  maxRequestTimeout: Duration;
};

export type IHEGatewayJavaProps = {
  /**
   * Java's `-Xmx` value.
   *
   * @see {@link https://eclipse.dev/openj9/docs/xms/}
   */
  maxHeapSize: string;
  /**
   * Java's `-Xms` value.
   *
   * @see {@link https://eclipse.dev/openj9/docs/xms/}
   */
  initialHeapSize: string;
};

export type IHEGatewayProps = {
  secretNames: {
    LICENSE_KEY: string;
    _MP_KEYSTORE_STOREPASS: string;
    _MP_KEYSTORE_KEYPASS: string;
    AWS_ACCESS_KEY_ID: string;
    AWS_SECRET_ACCESS_KEY: string;
    ADMIN_PASSWORD: string;
  };
  vpcId: string;
  certArn: string;
  trustStoreBucketName: string;
  trustStoreKey: string;
  subdomain: string; // Subdomain for IHE integrations
  outboundSubdomain: string; // Subdomain for Outbound IHE integrations
  /**
   * ID of the existing private hosted zone where the IHE Gateway will be deployed.
   */
  privateZoneId: string;
  /**
   * Address of the API's load balancer.
   */
  apiBaseAddress: string;
  ecs: {
    inbound: IHEGatewayEcsProps;
    outbound: IHEGatewayEcsProps;
  };
  java: {
    inbound: IHEGatewayJavaProps;
    outbound: IHEGatewayJavaProps;
  };
  rds: {
    dbName: string;
    dbNameInbound: string;
    userName: string;
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
     * The minimum number of Aurora capacity units (ACUs) for a DB instance in an Aurora Serverless v2 cluster.
     * You can specify ACU values in half-step increments, such as 8, 8.5, 9, and so on. The smallest value that you can use is 0.5.
     * @see — http://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-rds-dbcluster-serverlessv2scalingconfiguration.html#cfn-rds-dbcluster-serverlessv2scalingconfiguration-mincapacity
     */
    minCapacity: number;
    /**
     * The maximum number of Aurora capacity units (ACUs) for a DB instance in an Aurora Serverless v2 cluster.
     * You can specify ACU values in half-step increments, such as 40, 40.5, 41, and so on. The largest value that you can use is 128.
     * The maximum capacity must be higher than 0.5 ACUs.
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
    alarmThresholds?: RDSAlarmThresholds;
  };
  inboundPorts: {
    patientDiscovery: number;
    documentQuery: number;
    documentRetrieval: number;
  };
  outboundPorts: {
    patientDiscovery: number;
    documentQuery: number;
    documentRetrieval: number;
  };
  keystoreName: string;
  keystoreType: string;
  /**
   * Maximum amount of connections to the database.
   * To be passed to `database.max-connections`.
   */
  maxDbConnections: number;
  /**
   * IHE GW's Administrator App admin username
   */
  adminUsername: string;
  snsTopicArn?: string;
};
