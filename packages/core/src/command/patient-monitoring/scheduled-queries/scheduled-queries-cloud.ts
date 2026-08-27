import { createUuidFromText } from "@metriport/shared/common/uuid";
import { SQSClient } from "../../../external/aws/sqs";
import { Config } from "../../../util/config";
import { RunScheduledQueriesRequest, ScheduledQueries } from "./scheduled-queries";

/**
 * Cloud implementation that sends a message to SQS queue for async processing.
 */
export class ScheduledQueriesCloud implements ScheduledQueries {
  constructor(
    private readonly queueUrl: string = Config.getPatientMonitoringScheduledQueriesQueueUrl(),
    private readonly sqsClient: SQSClient = new SQSClient({ region: Config.getAWSRegion() })
  ) {}

  async runScheduledQueries(request: RunScheduledQueriesRequest): Promise<void> {
    const payload = JSON.stringify(request);
    await this.sqsClient.sendMessageToQueue(this.queueUrl, payload, {
      fifo: true,
      messageDeduplicationId: createUuidFromText(payload),
      messageGroupId: request.cxId,
    });
  }
}
