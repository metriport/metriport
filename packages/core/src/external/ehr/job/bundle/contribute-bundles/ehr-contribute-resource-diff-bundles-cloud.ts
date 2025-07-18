import { executeWithNetworkRetries } from "@metriport/shared";
import { createUuidFromText } from "@metriport/shared/common/uuid";
import { Config } from "../../../../../util/config";
import { SQSClient } from "../../../../aws/sqs";
import {
  ContributeResourceDiffBundlesRequest,
  EhrContributeResourceDiffBundlesHandler,
} from "./ehr-contribute-resource-diff-bundles";

/**
 * This class is used to contribute resource diff bundles in the cloud.
 * It sends messages to the resource diff bundle queue for each resource type.
 * The queue is configured to deduplicate messages based on the payload.
 *
 */
export class EhrContributeResourceDiffBundlesCloud
  implements EhrContributeResourceDiffBundlesHandler
{
  constructor(
    private readonly ehrContributeDiffBundlesQueueUrl: string = Config.getEhrContributeDiffBundlesQueueUrl(),
    private readonly sqsClient: SQSClient = new SQSClient({ region: Config.getAWSRegion() })
  ) {}

  async contributeResourceDiffBundles(params: ContributeResourceDiffBundlesRequest): Promise<void> {
    const payload = JSON.stringify(params);
    await executeWithNetworkRetries(async () => {
      await this.sqsClient.sendMessageToQueue(this.ehrContributeDiffBundlesQueueUrl, payload, {
        fifo: true,
        messageDeduplicationId: createUuidFromText(payload),
        messageGroupId: params.metriportPatientId,
      });
    });
  }
}
