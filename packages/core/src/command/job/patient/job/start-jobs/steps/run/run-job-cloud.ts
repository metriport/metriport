import { executeWithNetworkRetries } from "@metriport/shared";
import { SQSClient } from "../../../../../../../external/aws/sqs";
import { Config } from "../../../../../../../util/config";
import { RunJobHandler, RunJobRequest } from "./run-job";

export class RunJobCloud implements RunJobHandler {
  private readonly sqsClient: SQSClient;

  constructor(private readonly runJobQueueUrl: string, region?: string, sqsClient?: SQSClient) {
    this.sqsClient = sqsClient ?? new SQSClient({ region: region ?? Config.getAWSRegion() });
  }

  async runJob(params: RunJobRequest): Promise<void> {
    const payload = JSON.stringify(params);
    await executeWithNetworkRetries(async () => {
      await this.sqsClient.sendMessageToQueue(this.runJobQueueUrl, payload);
    });
  }
}
