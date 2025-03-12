import { S3Utils, UploadParamsBuffer, UploadParamsString } from "@metriport/core/external/aws/s3";

export class MockS3Utils extends S3Utils {
  override async uploadFile(params: UploadParamsString): Promise<AWS.S3.ManagedUpload.SendData>;
  override async uploadFile(params: UploadParamsBuffer): Promise<AWS.S3.ManagedUpload.SendData>;
  override async uploadFile({
    bucket,
    key,
    contentType,
  }: UploadParamsBuffer | UploadParamsString): Promise<AWS.S3.ManagedUpload.SendData> {
    console.log(
      `Mock uploadFile called for ${bucket} and ${key} and with content type ${contentType}`
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
