import { S3Client } from "@aws-sdk/client-s3";
import * as AWS from "aws-sdk";

export function makeS3Client(region: string): AWS.S3 {
  return new AWS.S3({ signatureVersion: "v4", region });
}
export class S3Utils {
  /**
   * @deprecated This is v2 of the S3 client. Use `s3Client` instead.
   */
  public readonly _s3: AWS.S3;
  public readonly _s3Client: S3Client;

  constructor(readonly region: string) {
    this._s3 = makeS3Client(region);
    this._s3Client = new S3Client({ region });
  }

  /**
   * @deprecated This is v2 of the S3 client. Use `s3Client` instead.
   */
  get s3(): AWS.S3 {
    return this._s3;
  }

  get s3Client(): S3Client {
    return this._s3Client;
  }
  async downloadFile({ bucket, key }: { bucket: string; key: string }): Promise<Buffer> {
    const params = {
      Bucket: bucket,
      Key: key,
    };
    try {
      const resp = await this._s3.getObject(params).promise();
      return resp.Body as Buffer;
    } catch (error) {
      console.log(`Error during download: ${error}`);
      throw error;
    }
  }
}
