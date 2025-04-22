import { sleep } from "@metriport/shared";
import { chunk } from "lodash";
import { Config } from "../../../../../util/config";
import { SQSClient } from "../../../../aws/sqs";
import {
  ComputeResourceDiffRequest,
  EhrComputeResourceDiffHandler,
} from "./ehr-compute-resource-diff";

export const MAX_SQS_MESSAGE_SIZE = 256000;
const MAX_SQS_MESSAGE_BATCH_SIZE = 100;
const MAX_SQS_MESSAGE_BATCH_SIZE_TO_SLEEP = 1000;

export class EhrComputeResourceDiffCloud implements EhrComputeResourceDiffHandler {
  private readonly sqsClient: SQSClient;

  constructor(
    private readonly ehrComputeResourceDiffQueueUrl: string,
    region?: string,
    sqsClient?: SQSClient
  ) {
    this.sqsClient = sqsClient ?? new SQSClient({ region: region ?? Config.getAWSRegion() });
  }

  async computeResourceDiff(params: ComputeResourceDiffRequest[]): Promise<void> {
    const paramsWithoutExistingResources: ComputeResourceDiffRequest[] = params.map(p => ({
      ...p,
      existingResources:
        Buffer.from(JSON.stringify(p)).length > MAX_SQS_MESSAGE_SIZE
          ? undefined
          : p.existingResources,
    }));
    const chunks = chunk(paramsWithoutExistingResources, MAX_SQS_MESSAGE_BATCH_SIZE);
    for (const chunk of chunks) {
      await Promise.all(
        chunk.map(p =>
          this.sqsClient.sendMessageToQueue(this.ehrComputeResourceDiffQueueUrl, JSON.stringify(p))
        )
      );
      await sleep(MAX_SQS_MESSAGE_BATCH_SIZE_TO_SLEEP);
    }
  }
}
