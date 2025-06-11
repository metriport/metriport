import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { SftpReplica } from "../types";

export class S3Replica implements SftpReplica {
  private readonly client: S3Client;
  private readonly bucketName: string;

  constructor({ bucketName, region }: { bucketName: string; region: string }) {
    this.client = new S3Client({
      region,
    });
    this.bucketName = bucketName;
  }

  async listFileNames(directoryName: string): Promise<string[]> {
    const fileNames: string[] = [];
    let continuationToken: string | undefined;
    do {
      const command = new ListObjectsV2Command({
        Bucket: this.bucketName,
        Prefix: directoryName,
        ContinuationToken: continuationToken,
      });
      const response = await this.client.send(command);
      const keys = (response.Contents?.map(content => content.Key).filter(Boolean) ??
        []) as string[];
      fileNames.push(...keys);
      continuationToken = response.NextContinuationToken;
    } while (continuationToken);
    return fileNames;
  }

  async readFile(filePath: string): Promise<Buffer> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: filePath,
    });
    const response = await this.client.send(command);
    return Buffer.from((await response.Body?.transformToByteArray()) ?? []);
  }

  async readFileMetadata<M extends object>(filePath: string): Promise<M | undefined> {
    const command = new HeadObjectCommand({
      Bucket: this.bucketName,
      Key: filePath,
    });
    const response = await this.client.send(command);
    return response.Metadata as M | undefined;
  }

  async writeFile<M extends object>(
    filePath: string,
    content: Buffer,
    metadata?: M
  ): Promise<void> {
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: filePath,
      Body: content,
      Metadata: metadata as Record<string, string> | undefined,
    });
    await this.client.send(command);
  }

  async hasFile(filePath: string): Promise<boolean> {
    const command = new HeadObjectCommand({
      Bucket: this.bucketName,
      Key: filePath,
    });
    const response = await this.client.send(command);
    return response.Metadata !== undefined;
  }
}
