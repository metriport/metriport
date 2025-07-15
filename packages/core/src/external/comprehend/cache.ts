import { S3Utils } from "../../external/aws/s3";

export class ComprehendCacheBucket {
  private readonly s3: S3Utils;
  private readonly bucket: string;

  constructor({ bucket, region }: { bucket: string; region: string }) {
    this.s3 = new S3Utils(region);
    this.bucket = bucket;
  }

  async get(key: string): Promise<string | undefined> {
    const existsInCache = await this.s3.fileExists(this.bucket, key);
    if (existsInCache) {
      const cacheContent = await this.s3.downloadFile({ bucket: this.bucket, key });
      return cacheContent.toString();
    }
    return undefined;
  }

  async set(key: string, value: string): Promise<void> {
    await this.s3.uploadFile({
      bucket: this.bucket,
      key,
      file: Buffer.from(value, "utf-8"),
      contentType: "application/json",
    });
  }
}
