import { SQSClient } from "../../external/aws/sqs";
import { Config } from "../../util/config";
import { capture } from "../../util/notifications";
import { Hl7Notification, Hl7NotificationWebhookSender } from "./hl7-notification-webhook-sender";
import { createUuidFromText } from "@metriport/shared/common/uuid";

const region = Config.getAWSRegion();
const sqsClient = new SQSClient({ region });

export class Hl7NotificationWebhookSenderCloud implements Hl7NotificationWebhookSender {
  private readonly queueUrl: string;

  constructor(destinationQueueUrl: string) {
    this.queueUrl = destinationQueueUrl;
  }

  async execute(params: Hl7Notification): Promise<void> {
    const { cxId, patientId, messageReceivedTimestamp } = params;
    capture.setExtra({
      cxId,
      patientId,
      messageReceivedTimestamp: messageReceivedTimestamp,
      context: "hl7-notification-webhook-sender-cloud.execute",
    });

    const payload = JSON.stringify(params);
    await sqsClient.sendMessageToQueue(this.queueUrl, payload, {
      fifo: true,
      messageGroupId: `${cxId}_${patientId}`,
      messageDeduplicationId: createUuidFromText(payload),
    });
  }
}
