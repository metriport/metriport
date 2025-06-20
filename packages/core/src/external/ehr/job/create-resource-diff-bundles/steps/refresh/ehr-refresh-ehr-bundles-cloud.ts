import { executeWithNetworkRetries } from "@metriport/shared";
import { createUuidFromText } from "@metriport/shared/common/uuid";
import { Config } from "../../../../../../util/config";
import { SQSClient } from "../../../../../aws/sqs";
import { createSqsGroupId } from "../../shared";
import { EhrRefreshEhrBundlesHandler, RefreshEhrBundlesRequest } from "./ehr-refresh-ehr-bundles";

/**
 * This class is used to refresh EHR bundles in the cloud.
 * It sends messages to the EHR refresh queue for each resource type.
 * The queue is configured to deduplicate messages based on the payload.
 *
 */
export class EhrRefreshEhrBundlesCloud implements EhrRefreshEhrBundlesHandler {
  private readonly sqsClient: SQSClient;

  constructor(
    private readonly ehrRefreshEhrBundlesQueueUrl: string,
    region: string = Config.getAWSRegion(),
    sqsClient?: SQSClient
  ) {
    this.sqsClient = sqsClient ?? new SQSClient({ region });
  }

  async refreshEhrBundles(params: RefreshEhrBundlesRequest): Promise<void> {
    const { metriportPatientId, resourceType } = params;
    const payload = JSON.stringify(params);
    await executeWithNetworkRetries(async () => {
      await this.sqsClient.sendMessageToQueue(this.ehrRefreshEhrBundlesQueueUrl, payload, {
        fifo: true,
        messageDeduplicationId: createUuidFromText(payload),
        messageGroupId: createSqsGroupId(metriportPatientId, resourceType),
      });
    });
  }
}
