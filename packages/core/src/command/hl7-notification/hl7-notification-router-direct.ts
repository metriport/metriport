import { out } from "../../util/log";
import { Hl7Notification, Hl7NotificationRouter } from "./hl7-notification-router";

export class Hl7NotificationRouterDirect implements Hl7NotificationRouter {
  private readonly lambdaName = "hl7-notification-router-direct";
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
