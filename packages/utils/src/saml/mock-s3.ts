import { S3Utils, UploadFileResult } from "@metriport/core/external/aws/s3";

export class MockS3Utils extends S3Utils {
  override async uploadFile({
    bucket,
    key,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    file,
    contentType,
  }: {
    bucket: string;
    key: string;
    file: Buffer;
    contentType?: string;
  }): Promise<UploadFileResult> {
    console.log(
      `Mock uploadFile called for ${bucket} and ${key} and with content type ${contentType}`
    );
    return {
      location: `https://mocks3.${this.region}.amazonaws.com/${bucket}/${key}`,
      eTag: "mockETag",
      bucket: bucket,
      key: key,
      versionId: "mockVersionId",
    };
  }

  override async getFileInfoFromS3(): Promise<{ exists: false }> {
    return { exists: false };
  }
  override buildFileUrl(bucket: string, key: string): string {
    return `https://mocks3.${this.region}.amazonaws.com/${bucket}/${key}`;
  }
}
