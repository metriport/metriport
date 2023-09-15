import S3 from "aws-sdk/clients/s3";
import * as stream from "stream";

export class S3Utils {
  public readonly _s3: S3;

  constructor(readonly region: string) {
    this._s3 = new S3({ signatureVersion: "v4", region });
  }

  get s3(): S3 {
    return this._s3;
  }

  getFileContentsAsString(s3BucketName: string, s3FileName: string): Promise<string> {
    const stream = this.s3.getObject({ Bucket: s3BucketName, Key: s3FileName }).createReadStream();
    return this.streamToString(stream);
  }

  streamToString(stream: stream.Readable): Promise<string> {
    const chunks: Buffer[] = [];
    return new Promise((resolve, reject) => {
      stream.on("data", chunk => chunks.push(Buffer.from(chunk)));
      stream.on("error", err => reject(err));
      stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    });
  }

  async getFileInfoFromS3(
    key: string,
    bucket: string
  ): Promise<
    | { exists: true; size: number; contentType: string }
    | { exists: false; size?: never; contentType?: never }
  > {
    try {
      const head = await this.s3
        .headObject({
          Bucket: bucket,
          Key: key,
        })
        .promise();
      return { exists: true, size: head.ContentLength ?? 0, contentType: head.ContentType ?? "" };
    } catch (err) {
      return { exists: false };
    }
  }
}
