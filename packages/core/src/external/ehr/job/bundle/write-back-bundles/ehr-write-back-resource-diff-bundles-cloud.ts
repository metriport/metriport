import { executeWithNetworkRetries } from "@metriport/shared";
import { createUuidFromText } from "@metriport/shared/common/uuid";
import { Config } from "../../../../../util/config";
import { SQSClient } from "../../../../aws/sqs";
import {
  WriteBackResourceDiffBundlesRequest,
  EhrWriteBackResourceDiffBundlesHandler,
} from "./ehr-write-back-resource-diff-bundles";

/**
 * This class is used to write back resource diff bundles in the cloud.
 * It sends messages to the resource diff bundle queue for each resource type.
 * The queue is configured to deduplicate messages based on the payload.
 *
 */
export class EhrWriteBackResourceDiffBundlesCloud
  implements EhrWriteBackResourceDiffBundlesHandler
{
  constructor(
    private readonly ehrWriteBackDiffBundlesQueueUrl: string = Config.getEhrWriteBackDiffBundlesQueueUrl(),
    private readonly sqsClient: SQSClient = new SQSClient({ region: Config.getAWSRegion() })
  ) {}

  async writeBackResourceDiffBundles(params: WriteBackResourceDiffBundlesRequest): Promise<void> {
    const payload = JSON.stringify(params);
    await executeWithNetworkRetries(async () => {
      await this.sqsClient.sendMessageToQueue(this.ehrWriteBackDiffBundlesQueueUrl, payload, {
        fifo: true,
        messageDeduplicationId: createUuidFromText(payload),
        messageGroupId: params.metriportPatientId,
      });
    });
  }
}
