import { S3Utils } from "../../../external/aws/s3";
import { Config } from "../../../util/config";
import {
  Hl7SubscriptionLaHieIngestion,
  LaHieSftpClient,
  sendToWebhookSender,
} from "./hl7-subscriptions-sftp-ingestion";
import { PsvToHl7Converter } from "./psv-to-hl7-converter";

export class Hl7SubscriptionLaHieIngestionDirect implements Hl7SubscriptionLaHieIngestion {
  private sftpClient: LaHieSftpClient;
  private log: typeof console.log;

  constructor(sftpClient: LaHieSftpClient, log: typeof console.log) {
    this.sftpClient = sftpClient;
    this.log = log;
  }

  async execute(): Promise<void> {
    this.log("Beginning ingestion from LaHie");
    const remotePath = Config.getLaHieIngestionRemotePath();
    const fileNames = await this.sftpClient.safeSync(remotePath);

    const s3Utils = new S3Utils(Config.getAWSRegion());
    const bucketName = Config.getLaHieIngestionBucket();
    this.log(`Reading synced files`);
    for (const fileName of fileNames) {
      if (fileName === ".DS_Store") {
        continue;
      }
      const filePath = `${remotePath}/${fileName}`.replace(/^\//, "");
      console.log(`File path: ${filePath}`);
      const existsFile = await s3Utils.fileExists(bucketName, filePath);
      if (!existsFile) {
        throw new Error(`File ${filePath} does not exist`);
      }
      const contentAsString = await s3Utils.getFileContentsAsString(bucketName, filePath);
      const content = Buffer.from(contentAsString);
      this.log(`Converting file to hl7`);
      const psvToHl7Converter = new PsvToHl7Converter(content);
      const identifiedMessages = await psvToHl7Converter.getCxIdPtIdHl7MessageList();
      await s3Utils.deleteFile({ bucket: bucketName, key: filePath });
      this.log(`Sending to webhook sender`);
      await sendToWebhookSender(identifiedMessages);
    }

    this.log("Finished ingestion from LaHie");
  }
}
