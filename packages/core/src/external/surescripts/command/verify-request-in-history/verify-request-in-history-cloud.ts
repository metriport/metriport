import { executeWithNetworkRetries } from "@metriport/shared";
import { createUuidFromText } from "@metriport/shared/common/uuid";
import { Config } from "../../../../util/config";
import { SQSClient } from "../../../aws/sqs";
import { SurescriptsVerifyRequestInHistoryHandler } from "./verify-request-in-history";

export class SurescriptsVerifyRequestInHistoryHandlerCloud
  implements SurescriptsVerifyRequestInHistoryHandler
{
  private readonly sqsClient: SQSClient;

  constructor(
    private readonly surescriptsVerifyRequestHistoryQueueUrl: string,
    region?: string,
    sqsClient?: SQSClient
  ) {
    this.sqsClient = sqsClient ?? new SQSClient({ region: region ?? Config.getAWSRegion() });
  }

  async verifyRequestInHistory({ transmissionId }: { transmissionId: string }): Promise<void> {
    const payload = JSON.stringify({ transmissionId });
    await executeWithNetworkRetries(async () => {
      await this.sqsClient.sendMessageToQueue(
        this.surescriptsVerifyRequestHistoryQueueUrl,
        payload,
        {
          fifo: true,
          messageDeduplicationId: createUuidFromText(payload),
          messageGroupId: transmissionId,
        }
      );
    });
  }
}
