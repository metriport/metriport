import { MetriportError, sleep } from "@metriport/shared";
import { createUuidFromText } from "@metriport/shared/common/uuid";
import { chunk } from "lodash";
import { Config } from "../../../../../../util/config";
import {
  MAX_SQS_MESSAGE_SIZE,
  SQS_MESSAGE_BATCH_MILLIS_TO_SLEEP,
  SQS_MESSAGE_BATCH_SIZE_FIFO,
} from "../../../../../../util/sqs";
import { SQSClient } from "../../../../../aws/sqs";
import {
  ComputeResourceDiffBundlesRequest,
  EhrComputeResourceDiffBundlesHandler,
} from "./ehr-compute-resource-diff-bundles";

export class EhrComputeResourceDiffBundlesCloud implements EhrComputeResourceDiffBundlesHandler {
  private readonly sqsClient: SQSClient;

  constructor(
    private readonly ehrComputeResourceDiffQueueUrl: string,
    region?: string,
    sqsClient?: SQSClient
  ) {
    this.sqsClient = sqsClient ?? new SQSClient({ region: region ?? Config.getAWSRegion() });
  }

  async computeResourceDiffBundlesMetriportOnly(
    params: ComputeResourceDiffBundlesRequest[]
  ): Promise<void> {
    const paramsWithoutExistingResources = params.map(p => ({
      ...p,
      existingResources:
        Buffer.from(JSON.stringify(p)).length > MAX_SQS_MESSAGE_SIZE
          ? undefined
          : p.existingResources,
    }));
    const chunks = chunk(paramsWithoutExistingResources, SQS_MESSAGE_BATCH_SIZE_FIFO);
    for (const chunk of chunks) {
      await Promise.all(
        chunk.map(params => {
          const payload = JSON.stringify(params);
          return this.sqsClient.sendMessageToQueue(this.ehrComputeResourceDiffQueueUrl, payload, {
            fifo: true,
            messageDeduplicationId: createUuidFromText(payload),
            messageGroupId: params.ehrPatientId,
          });
        })
      );
      await sleep(SQS_MESSAGE_BATCH_MILLIS_TO_SLEEP);
    }
  }

  async computeResourceDiffBundlesEhrOnly(): Promise<void> {
    throw new MetriportError("Resource diff bundle EhrOnly is not supported");
  }
}
