import { Hl7Message } from "@medplum/core";
import { S3Utils } from "../../../external/aws/s3";
import { Config } from "../../../util/config";
import {
  HIE_NAME,
  Hl7AlohrSftpIngestion,
  Hl7AlohrSftpIngestionParams,
  log,
  TimestampedMessage,
} from "./hl7-alohr-sftp-ingestion";
import { AlohrSftpIngestionClient } from "./hl7-alohr-sftp-ingestion-client";
import { buildHl7NotificationWebhookSender } from "../../hl7-notification/hl7-notification-webhook-sender-factory";
import { Hl7NotificationSenderParams } from "../../hl7-notification/hl7-notification-webhook-sender";
import { buildDayjs } from "@metriport/shared/common/date";
import { getCxIdAndPatientIdOrFail } from "../../hl7v2-subscriptions/hl7v2-to-fhir-conversion/shared";

export class Hl7AlohrSftpIngestionDirect implements Hl7AlohrSftpIngestion {
  private sftpClient: AlohrSftpIngestionClient;

  constructor(sftpClient: AlohrSftpIngestionClient) {
    this.sftpClient = sftpClient;
  }

  async execute(params: Hl7AlohrSftpIngestionParams): Promise<void> {
    const s3Utils = new S3Utils(Config.getAWSRegion());
    const bucketName = Config.getAlohrIngestionBucket();
    const remotePath = Config.getAlohrIngestionRemotePath();

    log("Beginning ingestion from Alohr");
    const fileNames = await this.sftpClient.safeSyncWithDate(remotePath, params.dateTimestamp);

    log(`Reading synced files`);
    const timestampedMessages: TimestampedMessage[] = [];

    for (const fileName of fileNames) {
      const filePath = this.getFilePath(remotePath, fileName);
      const existsFile = await s3Utils.fileExists(bucketName, filePath);
      if (!existsFile) {
        throw new Error(`File ${filePath} does not exist`);
      }

      const message = await s3Utils.getFileContentsAsString(bucketName, filePath);
      const recievedAt = buildDayjs(Date.now()).toISOString();

      const hl7Message = Hl7Message.parse(message);
      const { cxId, patientId } = getCxIdAndPatientIdOrFail(hl7Message);

      timestampedMessages.push({
        message: message,
        timestamp: recievedAt,
        cxId: cxId,
        patientId: patientId,
      });
    }

    log(`Sending to webhook sender`);
    await this.sendToWebhookSender(timestampedMessages);
  }

  private async sendToWebhookSender(timestampedMessages: TimestampedMessage[]): Promise<void> {
    for (const msg of timestampedMessages) {
      const webhookSender = buildHl7NotificationWebhookSender();
      const webhookSenderParams: Hl7NotificationSenderParams = {
        cxId: msg.cxId,
        patientId: msg.patientId,
        message: msg.message,
        messageReceivedTimestamp: msg.timestamp,
        hieName: HIE_NAME,
      };

      await webhookSender.execute(webhookSenderParams);
    }
  }

  private getFilePath(remotePath: string, fileName: string): string {
    return `${remotePath}/${fileName}`.replace(/^\//, "");
  }
}
