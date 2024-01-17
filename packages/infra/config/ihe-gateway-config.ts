import { Duration } from "aws-cdk-lib";
import { ECS_CPU, ECS_MEMORY } from "./aws/ecs";
import { RDSAlarmThresholds } from "./aws/rds";

export type IHEGatewayProps = {
  vpcId: string;
  certArn: string;
  subdomain: string; // Subdomain for IHE integrations
  privateZoneId: string;
  ecs: {
    // Watch out for the combination of vCPUs and memory, more vCPU requires more memory
    // https://docs.aws.amazon.com/AmazonECS/latest/developerguide/task_definition_parameters.html#task_size
    /**
     * Determines the valid CPU values.
     */
    memory: ECS_MEMORY;
    /**
     * Determined by the memory value.
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
    documentRetrieve?: number;
  };
  snsTopicArn?: string;
};
