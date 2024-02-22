import { Duration } from "aws-cdk-lib";
import { ECS_CPU, ECS_MEMORY } from "./aws/ecs";
import { RDSAlarmThresholds } from "./aws/rds";

export type IHEGatewayProps = {
  secretNames: {
    LICENSE_KEY: string;
    _MP_KEYSTORE_STOREPASS: string;
    _MP_KEYSTORE_KEYPASS: string;
  };
  vpcId: string;
  subdomain: string; // Subdomain for IHE integrations
  /**
   * ID of the existing private hosted zone where the IHE Gateway will be deployed.
   */
  privateZoneId: string;
  ecs: {
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
  java: {
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
  rds: {
    dbName: string;
    userName: string;
    minDBCap: number;
    maxDBCap: number;
    minSlowLogDurationInMs: number;
    alarmThresholds?: RDSAlarmThresholds;
  };
  ports: {
    patientDiscovery: number;
    documentQuery: number;
    /**
     * Optional in case its shared with document query
     */
    documentRetrieval?: number;
  };
  keystoreName: string;
  keystoreType: string;
  snsTopicArn?: string;
};
