import { S3Client, HeadObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { SurescriptsSftpClient } from "./client";

type SurescriptsDirectory = "from_surescripts" | "to_surescripts";

export class SurescriptsReplica {
  private readonly s3: S3Client;
  private readonly bucket: string;
  private readonly sftp: SurescriptsSftpClient;

  constructor(bucket: string) {
    this.s3 = new S3Client({ region: process.env.AWS_REGION ?? "us-east-2" });
    this.sftp = new SurescriptsSftpClient({});
    this.bucket = bucket;
  }

  async synchronize(directory: SurescriptsDirectory) {
    await this.sftp.connect();
    const files = await this.sftp.list("/" + directory);
    for (const file of files) {
      const key = directory + "/" + file;
      const exists = await this.existsInS3(key);

      if (exists) {
        console.log(`File ${key} exists in S3`);
      } else {
        console.log(`File ${key} does not exist in S3`);
        const content = await this.sftp.read(`/${directory}/${file}`);
        await this.writeToS3(key, content);
      }
    }
  }

  private async writeToS3(key: string, content: Buffer) {
    await this.s3.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: content }));
  }

  private async existsInS3(key: string) {
    try {
      await this.s3.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return true;
    } catch (error) {
      return false;
    }
  }
}
