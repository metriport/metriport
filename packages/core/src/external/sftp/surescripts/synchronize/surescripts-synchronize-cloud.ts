import { createUuidFromText } from "@metriport/shared/common/uuid";
import { Config } from "../../../../util/config";
import { SQSClient } from "../../../aws/sqs";
import {
  SurescriptsSynchronizeHandler,
  ProcessSynchronizeRequest,
} from "./surescripts-synchronize";

export class SurescriptsSynchronizeCloud implements SurescriptsSynchronizeHandler {
  private readonly sqsClient: SQSClient;

  constructor(
    private readonly surescriptsSynchronizeQueueUrl: string,
    region?: string,
    sqsClient?: SQSClient
  ) {
    this.sqsClient = sqsClient ?? new SQSClient({ region: region ?? Config.getAWSRegion() });
  }

  async processSynchronize(params: ProcessSynchronizeRequest): Promise<void> {
    const payload = JSON.stringify(params);
    await this.sqsClient.sendMessageToQueue(this.surescriptsSynchronizeQueueUrl, payload, {
      fifo: true,
      messageDeduplicationId: createUuidFromText(payload),
      messageGroupId: "surescripts-synchronize",
    });
  }
}
