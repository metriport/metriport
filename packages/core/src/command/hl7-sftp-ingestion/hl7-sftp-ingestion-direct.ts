import { buildDayjs } from "@metriport/shared/common/date";
import * as openpgp from "openpgp";
import { S3Utils } from "../../external/aws/s3";
import { getSecretValueOrFail } from "../../external/aws/secret-manager";
import { Config } from "../../util/config";
import { Hl7NotificationSenderParams } from "../hl7-notification/hl7-notification-webhook-sender";
import { buildHl7NotificationWebhookSender } from "../hl7-notification/hl7-notification-webhook-sender-factory";
import { HIE_NAME, Hl7SubscriptionLahieIngestion } from "./hl7-subscriptions-sftp-ingestion";
import { IdentifiedHl7Message, PsvToHl7Converter } from "./psv-to-hl7-converter";
import { SftpIngestionClient } from "./sftp-ingestion-client";
import { asString } from "../hl7-notification/utils";

const TIMEZONE = "America/Chicago";

export class Hl7SubscriptionLahieIngestionDirect implements Hl7SubscriptionLahieIngestion {
  private sftpClient: SftpIngestionClient;
  private log: typeof console.log;

  constructor(sftpClient: SftpIngestionClient, log: typeof console.log) {
    this.sftpClient = sftpClient;
    this.log = log;
  }

  async execute(): Promise<void> {
    this.log("Beginning ingestion from Lahie");
    const remotePath = Config.getLahieIngestionRemotePath();
    const s3Utils = new S3Utils(Config.getAWSRegion());
    const bucketName = Config.getLahieIngestionBucket();

    const fileNames = await this.sftpClient.safeSync(remotePath);

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
        timezone: TIMEZONE,
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

export async function getLahiePrivateKeyAndPassphrase(): Promise<{
  privateKeyArmored: string;
  passphrase: string;
}> {
  const privateKeyArmoredArn = Config.getLahieIngestionPrivateKeyArn();
  const passphraseArn = Config.getLahieIngestionPrivateKeyPassphraseArn();

  const privateKeyArmored = await getSecretValueOrFail(privateKeyArmoredArn, Config.getAWSRegion());
  const passphrase = await getSecretValueOrFail(passphraseArn, Config.getAWSRegion());

  return { privateKeyArmored, passphrase };
}

/**
 * Decrypts GPG encrypted content using the private key and passphrase. Called within the sftp client before storing the file in S3.
 * @param content GPG encrypted content
 * @returns Decrypted content
 */
export async function decryptGpgBinaryWithPrivateKey(
  content: Buffer,
  privateKeyArmored: string,
  passphrase: string
): Promise<Buffer> {
  const privateKey = await openpgp.readPrivateKey({ armoredKey: privateKeyArmored });
  const decryptionKey = await openpgp.decryptKey({ privateKey, passphrase });

  const message = await openpgp.readMessage({ binaryMessage: content });

  const { data } = await openpgp.decrypt({
    message,
    decryptionKeys: decryptionKey,
    format: "binary",
  });

  return Buffer.from(data as Uint8Array);
}
