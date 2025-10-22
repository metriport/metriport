import { SQSClient } from "../../../../../external/aws/sqs";
import { Config } from "../../../../../util/config";
import { RunJobHandler, RunJobRequest } from "./run-job";

export class RunJobCloud implements RunJobHandler {
  private readonly sqsClient: SQSClient;

  constructor(
    private readonly runJobQueueUrl: string,
    sqsClient: SQSClient = new SQSClient({ region: Config.getAWSRegion() })
  ) {
    this.sqsClient = sqsClient;
  }

  async runJob(params: RunJobRequest): Promise<void> {
    const payload = JSON.stringify(params);
    await this.sqsClient.sendMessageToQueue(this.runJobQueueUrl, payload, {
      fifo: true,
      messageDeduplicationId: params.id,
      messageGroupId: params.id,
    });
  }
}
