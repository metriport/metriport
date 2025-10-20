import { executeWithNetworkRetries } from "@metriport/shared";
import { createUuidFromText } from "@metriport/shared/common/uuid";
import { Config } from "../../../../util/config";
import { SQSClient } from "../../../aws/sqs";
import { SurescriptsSendBatchRequestHandler } from "./send-batch-request";
import { SurescriptsBatchRequest } from "../../types";

export class SurescriptsSendBatchRequestHandlerCloud implements SurescriptsSendBatchRequestHandler {
  private readonly sqsClient: SQSClient;

  constructor(
    private readonly surescriptsSendBatchRequestQueueUrl: string,
    region?: string,
    sqsClient?: SQSClient
  ) {
    this.sqsClient = sqsClient ?? new SQSClient({ region: region ?? Config.getAWSRegion() });
  }

  async sendBatchRequest(requestData: SurescriptsBatchRequest): Promise<void> {
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
