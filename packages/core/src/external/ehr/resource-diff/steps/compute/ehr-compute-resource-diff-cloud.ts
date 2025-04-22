import { sleep } from "@metriport/shared";
import { chunk } from "lodash";
import { Config } from "../../../../../util/config";
import {
  MAX_SQS_MESSAGE_BATCH_SIZE,
  MAX_SQS_MESSAGE_BATCH_SIZE_TO_SLEEP,
  MAX_SQS_MESSAGE_SIZE,
} from "../../../../../util/sqs";
import { SQSClient } from "../../../../aws/sqs";
import {
  ComputeResourceDiffRequest,
  EhrComputeResourceDiffHandler,
} from "./ehr-compute-resource-diff";
import { createUuidFromText } from "@metriport/shared/common/uuid";

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
        chunk.map(params => {
          const payload = JSON.stringify(params);
          return this.sqsClient.sendMessageToQueue(this.ehrComputeResourceDiffQueueUrl, payload, {
            fifo: true,
            messageDeduplicationId: createUuidFromText(payload),
            messageGroupId: params.cxId,
          });
        })
      );
      await sleep(MAX_SQS_MESSAGE_BATCH_SIZE_TO_SLEEP);
    }
  }
}
