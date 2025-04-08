import { out } from "../../util/log";
import { Hl7Notification, Hl7NotificationRouter } from "./hl7-notification-router";

export class Hl7NotificationRouterLocal implements Hl7NotificationRouter {
  private readonly lambdaName = "hl7-notification-router-local";
  private readonly log;

  constructor() {
    const { log } = out(this.lambdaName);
    this.log = log;
  }

  async execute(params: Hl7Notification): Promise<void> {
    const { cxId, patientId } = params;

    this.log(`Invoking execute for cxId ${cxId} + patientId ${patientId}`);
  }
}
