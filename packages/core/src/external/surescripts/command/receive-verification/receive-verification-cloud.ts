import { executeWithNetworkRetries } from "@metriport/shared";
import { createUuidFromText } from "@metriport/shared/common/uuid";
import { Config } from "../../../../util/config";
import { SQSClient } from "../../../aws/sqs";
import { SurescriptsReceiveVerificationHandler } from "./receive-verification";

export class SurescriptsReceiveVerificationHandlerCloud
  implements SurescriptsReceiveVerificationHandler
{
  private readonly sqsClient: SQSClient;

  constructor(
    private readonly surescriptsReceiveVerificationQueueUrl: string,
    region?: string,
    sqsClient?: SQSClient
  ) {
    this.sqsClient = sqsClient ?? new SQSClient({ region: region ?? Config.getAWSRegion() });
  }

  async receiveVerification({ transmissionId }: { transmissionId: string }): Promise<void> {
    const payload = JSON.stringify({ transmissionId });
    await executeWithNetworkRetries(async () => {
      await this.sqsClient.sendMessageToQueue(
        this.surescriptsReceiveVerificationQueueUrl,
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
