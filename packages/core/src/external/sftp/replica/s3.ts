import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { Replica } from "./types";

export abstract class S3Replica implements Replica {
  private readonly client: S3Client;
  private readonly bucketName: string;

  constructor({ bucketName, region }: { bucketName: string; region: string }) {
    this.client = new S3Client({
      region,
    });
    this.bucketName = bucketName;
  }

  abstract listDirectoryNames(): string[];

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

  async readFile(directoryName: string, fileName: string): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: `${directoryName}/${fileName}`,
    });
    const response = await this.client.send(command);
    return response.Body?.transformToString("ascii") ?? "";
  }

  async readFileMetadata<M extends object>(
    directoryName: string,
    fileName: string
  ): Promise<M | undefined> {
    const command = new HeadObjectCommand({
      Bucket: this.bucketName,
      Key: `${directoryName}/${fileName}`,
    });
    const response = await this.client.send(command);
    return response.Metadata as M | undefined;
  }

  async writeFile<M extends object>(
    directoryName: string,
    fileName: string,
    content: string,
    metadata?: M
  ): Promise<void> {
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: `${directoryName}/${fileName}`,
      Body: content,
      Metadata: metadata as Record<string, string> | undefined,
    });
    await this.client.send(command);
  }

  async hasFile(directoryName: string, fileName: string): Promise<boolean> {
    const command = new HeadObjectCommand({
      Bucket: this.bucketName,
      Key: `${directoryName}/${fileName}`,
    });
    const response = await this.client.send(command);
    return response.Metadata !== undefined;
  }
}
