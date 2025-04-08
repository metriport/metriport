import { SQSClient } from "../../external/aws/sqs";
import { Config } from "../../util/config";
import { capture } from "../../util/notifications";
import { Hl7Notification, Hl7NotificationRouter } from "./hl7-notification-router";
import { createUuidFromText } from "@metriport/shared/common/uuid";

const region = Config.getAWSRegion();
const sqsClient = new SQSClient({ region });

export class Hl7NotificationRouterCloud implements Hl7NotificationRouter {
  private readonly queueUrl: string;

  constructor(destinationQueueUrl: string) {
    this.queueUrl = destinationQueueUrl;
  }

  async execute(params: Hl7Notification): Promise<void> {
    const { cxId, patientId } = params;
    const payload = JSON.stringify(params);
    capture.setExtra({
      cxId,
      patientId,
      payload,
      context: "hl7-notification-router-cloud.execute",
    });

    await sqsClient.sendMessageToQueue(this.queueUrl, payload, {
      fifo: true,
      messageGroupId: `${cxId}_${patientId}`,
      messageDeduplicationId: createUuidFromText(payload),
    });
  }
}
