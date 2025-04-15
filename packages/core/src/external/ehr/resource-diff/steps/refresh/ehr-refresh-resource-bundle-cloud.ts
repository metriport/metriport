import { createUuidFromText } from "@metriport/shared/common/uuid";
import { Config } from "../../../../../util/config";
import { SQSClient } from "../../../../aws/sqs";
import { EhrRefreshBundleHandler, RefreshBundleRequest } from "./ehr-refresh-resource-bundle";

export class EhrRefreshBundleCloud implements EhrRefreshBundleHandler {
  private readonly sqsClient: SQSClient;

  constructor(
    private readonly ehrRefreshBundleQueueUrl: string,
    region?: string,
    sqsClient?: SQSClient
  ) {
    if (!sqsClient) {
      this.sqsClient = new SQSClient({ region: region ?? Config.getAWSRegion() });
    } else {
      this.sqsClient = sqsClient;
    }
  }

  async refreshBundle(params: RefreshBundleRequest): Promise<void> {
    const { cxId } = params;
    const payload = JSON.stringify(params);
    await this.sqsClient.sendMessageToQueue(this.ehrRefreshBundleQueueUrl, payload, {
      fifo: true,
      messageDeduplicationId: createUuidFromText(payload),
      messageGroupId: cxId,
    });
  }
}
