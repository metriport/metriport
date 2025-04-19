import axios from "axios";
import { S3Utils } from "../../external/aws/s3";
import { Config } from "../../util/config";
import { out } from "../../util/log";
import { Hl7Notification, Hl7NotificationWebhookSender } from "./hl7-notification-webhook-sender";

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
    const { cxId, patientId, messageReceivedTimestamp } = params;

    await this.s3Utils.uploadFile({
      bucket: this.bucketName,
      key: "some/example/key",
      file: Buffer.from(params.message),
      contentType: "text/plain",
    });

    const api = axios.create({ baseURL: Config.getApiUrl() });
    this.log(
      `[${messageReceivedTimestamp}] Invoking execute for cxId ${cxId} + patientId ${patientId}`
    );
    const response = await api.get("/");
    this.log(`[${messageReceivedTimestamp}] response: ${JSON.stringify(response.data)}`);
  }
}
