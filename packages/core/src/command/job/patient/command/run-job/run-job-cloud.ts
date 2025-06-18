import { executeWithNetworkRetries } from "@metriport/shared";
import { createUuidFromText } from "@metriport/shared/common/uuid";
import { SQSClient } from "../../../../../external/aws/sqs";
import { Config } from "../../../../../util/config";
import { RunJobHandler, RunJobRequest } from "./run-job";

export class RunJobCloud implements RunJobHandler {
  private readonly sqsClient: SQSClient = new SQSClient({ region: Config.getAWSRegion() });

  constructor(private readonly runJobQueueUrl: string) {}

  async runJob(params: RunJobRequest): Promise<void> {
    const payload = JSON.stringify(params);
    await executeWithNetworkRetries(async () => {
      await this.sqsClient.sendMessageToQueue(this.runJobQueueUrl, payload, {
        fifo: true,
        messageDeduplicationId: createUuidFromText(payload),
        messageGroupId: params.id,
      });
    });
  }
}
