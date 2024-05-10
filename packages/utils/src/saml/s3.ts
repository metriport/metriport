import { S3Utils } from "@metriport/core/external/aws/s3";

export class MockS3Utils extends S3Utils {
  async uploadFile({
    bucket,
    key,
    //eslint-disable-next-line @typescript-eslint/no-unused-vars
    file,
    //eslint-disable-next-line @typescript-eslint/no-unused-vars
    contentType,
  }: {
    bucket: string;
    key: string;
    file: Buffer;
    contentType?: string;
  }): Promise<AWS.S3.ManagedUpload.SendData> {
    return {
      Location: `https://mocks3.${this.region}.amazonaws.com/${bucket}/${key}`,
      ETag: "mockETag",
      Bucket: bucket,
      Key: key,
    };
  }

  async getFileInfoFromS3(
    //eslint-disable-next-line @typescript-eslint/no-unused-vars
    key: string,
    //eslint-disable-next-line @typescript-eslint/no-unused-vars
    bucket: string
  ): Promise<{ exists: false }> {
    return { exists: false };
  }
  buildFileUrl(bucket: string, key: string): string {
    console.log("Mock buildFileUrl called");
    // Return a mock URL
    return `https://mocks3.${this.region}.amazonaws.com/${bucket}/${key}`;
  }
}
