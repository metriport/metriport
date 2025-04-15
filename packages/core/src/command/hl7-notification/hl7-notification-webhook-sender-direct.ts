import { out } from "../../util/log";
import { Hl7Notification, Hl7NotificationWebhookSender } from "./hl7-notification-webhook-sender";

export class Hl7NotificationWebhookSenderDirect implements Hl7NotificationWebhookSender {
  private readonly lambdaName = "hl7-notification-webhook-sender-direct";
  private readonly log;

  constructor() {
    const { log } = out(this.lambdaName);
    this.log = log;
  }

  async execute(params: Hl7Notification): Promise<void> {
    const { cxId, patientId, messageReceivedTimestamp } = params;

    this.log(
      `[${messageReceivedTimestamp}] Invoking execute for cxId ${cxId} + patientId ${patientId}`
    );
  }
}
