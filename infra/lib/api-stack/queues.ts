import { Queue } from "aws-cdk-lib/aws-sqs";
import { createQueue, QueueProps } from "../shared/sqs";

export type Props = QueueProps;

export function createFHIRConversionQueue(props: Props): Queue {
  return createQueue(props);
}
