import { executeWithNetworkRetries } from "@metriport/shared";
import { createUuidFromText } from "@metriport/shared/common/uuid";
import { Config } from "../../../../util/config";
import { SQSClient } from "../../../aws/sqs";
import { QuestJob } from "../../types";
import { QuestReceiveResponseHandler } from "./receive-response";

export class QuestReceiveResponseHandlerCloud implements QuestReceiveResponseHandler {
  private readonly sqsClient: SQSClient;

  constructor(
    private readonly questReceiveResponseQueueUrl: string,
    region?: string,
    sqsClient?: SQSClient
  ) {
    this.sqsClient = sqsClient ?? new SQSClient({ region: region ?? Config.getAWSRegion() });
  }

  async receiveResponse(job: QuestJob): Promise<void> {
    const payload = JSON.stringify(job);
    await executeWithNetworkRetries(async () => {
      await this.sqsClient.sendMessageToQueue(this.questReceiveResponseQueueUrl, payload, {
        fifo: true,
        messageDeduplicationId: createUuidFromText(payload),
        messageGroupId: job.dateString,
      });
    });
  }
}
