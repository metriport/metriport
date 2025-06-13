import { executeWithNetworkRetries } from "@metriport/shared";
import { createUuidFromText } from "@metriport/shared/common/uuid";
import { Config } from "../../../../util/config";
import { SQSClient } from "../../../aws/sqs";
import { SurescriptsFileIdentifier } from "../../types";
import { SurescriptsReceiveResponseHandler } from "./receive-response";

export class SurescriptsReceiveResponseHandlerCloud implements SurescriptsReceiveResponseHandler {
  private readonly sqsClient: SQSClient;

  constructor(
    private readonly surescriptsReceiveFlatFileResponseQueueUrl: string,
    region?: string,
    sqsClient?: SQSClient
  ) {
    this.sqsClient = sqsClient ?? new SQSClient({ region: region ?? Config.getAWSRegion() });
  }

  async receiveResponse({
    transmissionId,
    populationId,
  }: SurescriptsFileIdentifier): Promise<void> {
    const payload = JSON.stringify({ transmissionId, populationId });
    await executeWithNetworkRetries(async () => {
      await this.sqsClient.sendMessageToQueue(
        this.surescriptsReceiveFlatFileResponseQueueUrl,
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
