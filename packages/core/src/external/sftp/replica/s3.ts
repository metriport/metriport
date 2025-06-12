import { S3Utils } from "../../aws/s3";
import { SftpReplica } from "../types";

export class S3Replica implements SftpReplica {
  private readonly s3: S3Utils;
  private readonly bucketName: string;

  constructor({ bucketName, region }: { bucketName: string; region: string }) {
    this.s3 = new S3Utils(region);
    this.bucketName = bucketName;
  }

  getReplicaPath(remotePath: string): string {
    return remotePath.replace(/^\//, "");
  }

  async listFileNames(directoryName: string): Promise<string[]> {
    const fileObjects = await this.s3.listObjects(this.bucketName, directoryName);
    return fileObjects.map(content => content.Key).filter(Boolean) as string[];
  }

  async listFileNamesWithPrefix(directoryName: string, prefix: string): Promise<string[]> {
    const fileObjects = await this.s3.listObjects(
      this.bucketName,
      [directoryName, prefix].join("/")
    );
    return fileObjects.map(content => content.Key).filter(Boolean) as string[];
  }

  async readFile(replicaPath: string): Promise<Buffer> {
    return this.s3.downloadFile({ bucket: this.bucketName, key: replicaPath });
  }

  async writeFile(replicaPath: string, content: Buffer): Promise<void> {
    await this.s3.uploadFile({ bucket: this.bucketName, key: replicaPath, file: content });
  }

  async hasFile(replicaPath: string): Promise<boolean> {
    return this.s3.fileExists(this.bucketName, replicaPath);
  }
}
