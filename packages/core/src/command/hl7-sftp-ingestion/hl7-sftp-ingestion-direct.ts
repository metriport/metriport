import { buildDayjs } from "@metriport/shared/common/date";
import { S3Utils } from "../../external/aws/s3";
import { Config } from "../../util/config";
import { Hl7NotificationSenderParams } from "../hl7-notification/hl7-notification-webhook-sender";
import { buildHl7NotificationWebhookSender } from "../hl7-notification/hl7-notification-webhook-sender-factory";
import { HIE_NAME, Hl7LahieSftpIngestionParams, Hl7LahieSftpIngestion } from "./hl7-sftp-ingestion";
import { IdentifiedHl7Message, PsvToHl7Converter } from "./psv-to-hl7-converter";
import { LahieSftpIngestionClient } from "./sftp-ingestion-client";
import { asString } from "../hl7-notification/utils";

export class Hl7LahieSftpIngestionDirect implements Hl7LahieSftpIngestion {
  private sftpClient: LahieSftpIngestionClient;
  private log: typeof console.log;

  constructor(sftpClient: LahieSftpIngestionClient, log: typeof console.log) {
    this.sftpClient = sftpClient;
    this.log = log;
  }

  async execute(params: Hl7LahieSftpIngestionParams): Promise<void> {
    this.log("Beginning ingestion from Lahie");
    const remotePath = Config.getLahieIngestionRemotePath();
    const s3Utils = new S3Utils(Config.getAWSRegion());
    const bucketName = Config.getLahieIngestionBucket();

    if (Config.isStaging()) {
      this.log("Staging environment is not supported. There is no Lahie SFTP staging connection.");
      return;
    }

    const fileNames = await this.sftpClient.safeSyncWithDate(remotePath, params.dateTimestamp);

    this.log(`Reading synced files`);
    for (const fileName of fileNames) {
      const filePath = this.getFilePath(remotePath, fileName);
      const existsFile = await s3Utils.fileExists(bucketName, filePath);
      if (!existsFile) {
        throw new Error(`File ${filePath} does not exist`);
      }

      const contentAsString = await s3Utils.getFileContentsAsString(bucketName, filePath);
      const content = Buffer.from(contentAsString, "utf-8");

      this.log(`Converting file to hl7`);
      const psvToHl7Converter = new PsvToHl7Converter(content);
      const identifiedMessages = await psvToHl7Converter.getIdentifiedHl7Messages();

      this.log(`Sending to webhook sender`);
      await this.sendToWebhookSender(identifiedMessages);
    }

    this.log("Finished ingestion from Lahie");
  }

  private async sendToWebhookSender(identifiedMessages: IdentifiedHl7Message[]) {
    for (const { cxId, ptId, hl7Message } of identifiedMessages) {
      const messageReceivedTimestamp = buildDayjs(Date.now()).toISOString();

      const hl7NotificationParams: Hl7NotificationSenderParams = {
        cxId,
        patientId: ptId,
        message: asString(hl7Message),
        messageReceivedTimestamp,
        hieName: HIE_NAME,
      };
      await buildHl7NotificationWebhookSender().execute(hl7NotificationParams);
    }
  }

  /**
   * Creates the file path for the file in the remote directory. Removes the leading "/"
   * @param remotePath the remote directory
   * @param fileName the file name
   * @returns the file path
   */
  private getFilePath(remotePath: string, fileName: string): string {
    return `${remotePath}/${fileName}`.replace(/^\//, "");
  }
}
