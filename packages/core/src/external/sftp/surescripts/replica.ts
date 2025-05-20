import { Config } from "../../../util/config";
import { S3Client, HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { SurescriptsSftpClient } from "./client";

type SurescriptsDirectory = "from_surescripts" | "to_surescripts";

export class SurescriptsReplica {
  private readonly s3: S3Client;
  private readonly bucket: string;
  private readonly sftp: SurescriptsSftpClient;

  constructor(bucket?: string) {
    this.s3 = new S3Client({ region: process.env.AWS_REGION ?? "us-east-2" });
    this.sftp = new SurescriptsSftpClient({});
    this.bucket = bucket ?? Config.getSurescriptsReplicaBucketName();
  }

  async synchronize(directory: SurescriptsDirectory, dryRun = false) {
    await this.sftp.connect();
    const files = await this.sftp.list("/" + directory);
    for (const file of files) {
      const key = directory + "/" + file;
      const exists = await this.existsInS3(key);

      if (exists) {
        // console.log(`File ${key} exists in S3`);
      } else if (dryRun) {
        console.log(`Will copy:    SFTP /${directory}/${file} --> S3 ${key}`);
      } else {
        const content = await this.sftp.read(`/${directory}/${file}`);
        console.log("Read " + content.length + " bytes from SFTP");
        await this.writeToS3(key, content);
        // Depends on CDK deployment
      }
    }
  }

  private async writeToS3(key: string, content: Buffer) {
    await this.s3.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: content }));
  }

  private async existsInS3(key: string) {
    try {
      const result = await this.s3.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return result.ContentLength != null && result.ContentLength > 0;
    } catch (error) {
      return false;
    }
  }
}
