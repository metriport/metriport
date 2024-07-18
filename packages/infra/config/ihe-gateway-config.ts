import { Duration } from "aws-cdk-lib";
import { ECS_CPU, ECS_MEMORY } from "./aws/ecs";

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
  vpcId: string;
  certArn: string;
  ownershipCertArn: string;
  trustStoreBucketName: string;
  trustStoreKey: string;
  subdomain: string; // Subdomain for IHE integrations
  snsTopicArn?: string;
};
