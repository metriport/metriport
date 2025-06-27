import { executeWithNetworkRetries } from "@metriport/shared";
import { createUuidFromText } from "@metriport/shared/common/uuid";
import { Config } from "../../../../../../util/config";
import { SQSClient } from "../../../../../aws/sqs";
import { EhrRefreshEhrBundlesHandler, RefreshEhrBundlesRequest } from "./ehr-refresh-ehr-bundles";

/**
 * This class is used to refresh EHR bundles in the cloud.
 * It sends messages to the EHR refresh queue for each resource type.
 * The queue is configured to deduplicate messages based on the payload.
 *
 */
export class EhrRefreshEhrBundlesCloud implements EhrRefreshEhrBundlesHandler {
  constructor(
    private readonly ehrRefreshEhrBundlesQueueUrl: string = Config.getEhrRefreshEhrBundlesQueueUrl(),
    private readonly sqsClient: SQSClient = new SQSClient({ region: Config.getAWSRegion() })
  ) {}

  async refreshEhrBundles(params: RefreshEhrBundlesRequest): Promise<void> {
    const payload = JSON.stringify(params);
    await executeWithNetworkRetries(async () => {
      await this.sqsClient.sendMessageToQueue(this.ehrRefreshEhrBundlesQueueUrl, payload, {
        fifo: true,
        messageDeduplicationId: createUuidFromText(payload),
        messageGroupId: params.metriportPatientId,
      });
    });
  }
}
