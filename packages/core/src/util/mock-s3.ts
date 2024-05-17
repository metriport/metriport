import { S3Utils } from "../external/aws/s3";

export class MockS3Utils extends S3Utils {
  override async uploadFile({
    bucket,
    key,
    file,
    contentType,
  }: {
    bucket: string;
    key: string;
    file: Buffer;
    contentType?: string;
  }): Promise<AWS.S3.ManagedUpload.SendData> {
    console.log(
      `Mock uploadFile called for ${bucket} and ${key} and ${file} with content type ${contentType}`
    );
    return {
      Location: `https://mocks3.${this.region}.amazonaws.com/${bucket}/${key}`,
      ETag: "mockETag",
      Bucket: bucket,
      Key: key,
    };
  }

  override async getFileInfoFromS3(): Promise<{ exists: false }> {
    return { exists: false };
  }
  override buildFileUrl(bucket: string, key: string): string {
    return `https://mocks3.${this.region}.amazonaws.com/${bucket}/${key}`;
  }
}
