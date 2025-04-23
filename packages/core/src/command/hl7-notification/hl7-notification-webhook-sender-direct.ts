import { Hl7Message } from "@medplum/core";
import axios from "axios";
import { S3Utils } from "../../external/aws/s3";
import { Config } from "../../util/config";
import { out } from "../../util/log";
import {
  getHl7MessageTypeOrFail,
  getMessageUniqueIdentifier,
} from "../hl7v2-subscriptions/hl7v2-to-fhir-conversion/msh";
import { buildHl7MessageFileKey } from "../hl7v2-subscriptions/hl7v2-to-fhir-conversion/shared";
import { Hl7Notification, Hl7NotificationWebhookSender } from "./hl7-notification-webhook-sender";
import { convertHl7v2MessageToFhir } from "../hl7v2-subscriptions/hl7v2-to-fhir-conversion";

export class Hl7NotificationWebhookSenderDirect implements Hl7NotificationWebhookSender {
  private readonly context = "hl7-notification-webhook-sender";
  private readonly log;
  private readonly bucketName: string;
  private readonly s3Utils: S3Utils;

  constructor() {
    const { log } = out(this.context);
    this.log = log;
    this.bucketName = Config.getHl7OutgoingMessageBucketName();
    this.s3Utils = new S3Utils(Config.getAWSRegion());
  }

  async execute(params: Hl7Notification): Promise<void> {
    const message = Hl7Message.parse(params.message);
    const { cxId, patientId, messageReceivedTimestamp } = params;
    const { messageCode, triggerEvent } = getHl7MessageTypeOrFail(message);

    const fileKey = buildHl7MessageFileKey({
      cxId,
      patientId,
      timestamp: messageReceivedTimestamp,
      messageId: getMessageUniqueIdentifier(message),
      messageCode,
      triggerEvent,
      extension: "json",
    });

    const convertedMessage = convertHl7v2MessageToFhir({
      cxId,
      patientId,
      message,
      timestampString: messageReceivedTimestamp,
    });

    const result = await this.s3Utils.uploadFile({
      bucket: this.bucketName,
      key: fileKey,
      file: Buffer.from(JSON.stringify(convertedMessage)),
      contentType: "application/json",
    });

    this.log(`[${messageReceivedTimestamp}] S3 upload result: ${JSON.stringify(result)}`);

    const api = axios.create({ baseURL: Config.getApiUrl() });
    this.log(
      `[${messageReceivedTimestamp}] Sending webhook for cxId ${cxId} + patientId ${patientId}`
    );
    const response = await api.get("/");
    this.log(`[${messageReceivedTimestamp}] response: ${JSON.stringify(response.data)}`);
  }
}
