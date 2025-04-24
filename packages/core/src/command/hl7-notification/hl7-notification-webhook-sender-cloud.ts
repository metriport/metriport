import { SQSClient } from "../../external/aws/sqs";
import { Config } from "../../util/config";
import { out } from "../../util/log";
import { capture } from "../../util/notifications";
import {
  Hl7NotificationProps,
  Hl7NotificationWebhookSender,
} from "./hl7-notification-webhook-sender";
import { createUuidFromText } from "@metriport/shared/common/uuid";

export class Hl7NotificationWebhookSenderCloud implements Hl7NotificationWebhookSender {
  private readonly hl7NotificationWebhookSenderQueue: string;
  private readonly sqsClient: SQSClient;

  constructor(hl7NotificationWebhookSenderQueue: string, sqsClient?: SQSClient) {
    this.hl7NotificationWebhookSenderQueue = hl7NotificationWebhookSenderQueue;
    this.sqsClient = sqsClient ?? new SQSClient({ region: Config.getAWSRegion() });
  }

  async execute(params: Hl7NotificationProps): Promise<void> {
    const { cxId, patientId, messageReceivedTimestamp } = params;
    const { log } = out(`${messageReceivedTimestamp} - cx: ${cxId} - pt: ${patientId}`);
    capture.setExtra({
      cxId,
      patientId,
      messageReceivedTimestamp,
      context: "hl7-notification-webhook-sender-cloud.execute",
    });

    const payload = JSON.stringify(params);
    log(`Enqueueing message for processing`);
    await this.sqsClient.sendMessageToQueue(this.hl7NotificationWebhookSenderQueue, payload, {
      fifo: true,
      messageGroupId: patientId,
      messageDeduplicationId: createUuidFromText(payload),
    });
  }
}
