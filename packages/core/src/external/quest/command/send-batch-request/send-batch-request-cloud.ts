import { executeWithNetworkRetries } from "@metriport/shared";
import { createUuidFromText } from "@metriport/shared/common/uuid";
import { Config } from "../../../../util/config";
import { SQSClient } from "../../../aws/sqs";
import { QuestSendBatchRequestHandler } from "./send-batch-request";
import { QuestBatchRequest } from "../../types";

export class QuestSendBatchRequestHandlerCloud implements QuestSendBatchRequestHandler {
  private readonly sqsClient: SQSClient;

  constructor(
    private readonly surescriptsSendBatchRequestQueueUrl: string,
    region?: string,
    sqsClient?: SQSClient
  ) {
    this.sqsClient = sqsClient ?? new SQSClient({ region: region ?? Config.getAWSRegion() });
  }

  async sendBatchRequest(requestData: QuestBatchRequest): Promise<void> {
    const payload = JSON.stringify(requestData);
    await executeWithNetworkRetries(async () => {
      await this.sqsClient.sendMessageToQueue(this.surescriptsSendBatchRequestQueueUrl, payload, {
        fifo: true,
        messageDeduplicationId: createUuidFromText(payload),
        messageGroupId: requestData.cxId,
      });
    });
  }
}
