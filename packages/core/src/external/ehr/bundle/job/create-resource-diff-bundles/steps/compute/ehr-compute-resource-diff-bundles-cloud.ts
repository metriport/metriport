import { sleep } from "@metriport/shared";
import { createUuidFromText } from "@metriport/shared/common/uuid";
import { chunk } from "lodash";
import { Config } from "../../../../../../../util/config";
import {
  SQS_MESSAGE_BATCH_MILLIS_TO_SLEEP,
  SQS_MESSAGE_BATCH_SIZE_FIFO,
} from "../../../../../../../util/sqs";
import { SQSClient } from "../../../../../../aws/sqs";
import {
  ComputeResourceDiffBundlesRequest,
  EhrComputeResourceDiffBundlesHandler,
} from "./ehr-compute-resource-diff-bundles";

export class EhrComputeResourceDiffBundlesCloud implements EhrComputeResourceDiffBundlesHandler {
  private readonly sqsClient: SQSClient;

  constructor(
    private readonly ehrComputeResourceDiffQueueUrl: string,
    region: string = Config.getAWSRegion(),
    sqsClient?: SQSClient
  ) {
    this.sqsClient = sqsClient ?? new SQSClient({ region });
  }

  async computeResourceDiffBundles(params: ComputeResourceDiffBundlesRequest[]): Promise<void> {
    const chunks = chunk(params, SQS_MESSAGE_BATCH_SIZE_FIFO);
    for (const chunk of chunks) {
      await Promise.all(
        chunk.map(params => {
          const { ehrPatientId } = params;
          const payload = JSON.stringify(params);
          return this.sqsClient.sendMessageToQueue(this.ehrComputeResourceDiffQueueUrl, payload, {
            fifo: true,
            messageDeduplicationId: createUuidFromText(payload),
            messageGroupId: ehrPatientId,
          });
        })
      );
      await sleep(SQS_MESSAGE_BATCH_MILLIS_TO_SLEEP);
    }
  }
}
