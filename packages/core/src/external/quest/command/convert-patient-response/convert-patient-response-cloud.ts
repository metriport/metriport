import { executeWithNetworkRetries } from "@metriport/shared";
import { createUuidFromText } from "@metriport/shared/common/uuid";
import { Config } from "../../../../util/config";
import { SQSClient } from "../../../aws/sqs";
import {
  QuestConvertPatientResponseHandler,
  QuestPatientResponse,
} from "./convert-patient-response";

export class QuestConvertPatientResponseHandlerCloud implements QuestConvertPatientResponseHandler {
  constructor(
    private readonly queueUrl: string = Config.getQuestConvertPatientResponseQueueUrl(),
    private readonly sqsClient = new SQSClient({ region: Config.getAWSRegion() })
  ) {}

  async convertQuestPatientResponse(response: QuestPatientResponse): Promise<void> {
    const payload = JSON.stringify(response);
    await executeWithNetworkRetries(async () => {
      await this.sqsClient.sendMessageToQueue(this.queueUrl, payload, {
        fifo: true,
        messageDeduplicationId: createUuidFromText(payload),
        messageGroupId: response.externalId,
      });
    });
  }
}
