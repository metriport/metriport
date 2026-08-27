import { executeWithNetworkRetries } from "@metriport/shared";
import { createUuidFromText } from "@metriport/shared/common/uuid";
import { Config } from "../../../../util/config";
import { SQSClient } from "../../../aws/sqs";
import {
  SurescriptsBatchResponse,
  SurescriptsConvertBatchResponseHandler,
} from "./convert-batch-response";

export class SurescriptsConvertBatchResponseHandlerCloud
  implements SurescriptsConvertBatchResponseHandler
{
  constructor(
    private readonly queueUrl: string = Config.getSurescriptsConvertBatchResponseQueueUrl(),
    private readonly sqsClient = new SQSClient({ region: Config.getAWSRegion() })
  ) {}

  async convertBatchResponse(response: SurescriptsBatchResponse): Promise<void> {
    const payload = JSON.stringify(response);
    await executeWithNetworkRetries(async () => {
      await this.sqsClient.sendMessageToQueue(this.queueUrl, payload, {
        fifo: true,
        messageDeduplicationId: createUuidFromText(payload),
        messageGroupId: response.cxId,
      });
    });
  }
}
