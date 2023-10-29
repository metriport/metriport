import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl as getPresignedUrl } from "@aws-sdk/s3-request-presigner";
import * as AWS from "aws-sdk";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import * as stream from "stream";

dayjs.extend(duration);
const DEFAULT_SIGNED_URL_DURATION = dayjs.duration({ minutes: 3 }).asSeconds();

export function makeS3Client(region: string): AWS.S3 {
  return new AWS.S3({ signatureVersion: "v4", region });
}

export const createS3FileName = (cxId: string, patientId: string, fileName: string): string => {
  return `${cxId}/${patientId}/${cxId}_${patientId}_${fileName}`;
};

export const parseS3FileName = (
  fileKey: string
): { cxId: string; patientId: string; docId: string } | undefined => {
  if (fileKey.includes("/")) {
    const keyParts = fileKey.split("/");
    const docName = keyParts[keyParts.length - 1];
    if (docName) {
      const docNameParts = docName.split("_");
      const cxId = docNameParts[0];
      const patientId = docNameParts[1];
      const docId = docNameParts[2];
      if (cxId && patientId && docId) {
        return { cxId, patientId, docId };
      }
    }
  }
  return;
};

/**
 * @deprecated Use `S3Utils.getSignedUrl()` instead
 */
export async function getSignedUrl({
  awsRegion,
  ...req
}: {
  bucketName: string;
  fileName: string;
  durationSeconds?: number;
  awsRegion: string;
}): Promise<string> {
  return new S3Utils(awsRegion).getSignedUrl(req);
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
   * @deprecated This is v2 of the S3 client. Use `s3` instead.
   */
  get s3(): AWS.S3 {
    return this._s3;
  }

  get s3Client(): S3Client {
    return this._s3Client;
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

  async getSignedUrl({
    bucketName,
    fileName,
    durationSeconds,
  }: {
    bucketName: string;
    fileName: string;
    durationSeconds?: number;
  }): Promise<string> {
    return this.s3.getSignedUrlPromise("getObject", {
      Bucket: bucketName,
      Key: fileName,
      Expires: durationSeconds ?? DEFAULT_SIGNED_URL_DURATION,
    });
  }

  async getPresignedUploadUrl({
    bucket,
    key,
    durationSeconds,
  }: {
    bucket: string;
    key: string;
    durationSeconds?: number;
  }): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
    });
    const presignedUrl = await getPresignedUrl(this.s3Client, command, {
      expiresIn: durationSeconds ?? DEFAULT_SIGNED_URL_DURATION,
    });
    return presignedUrl;
  }

  buildFileUrl(bucket: string, key: string): string {
    return `https://${bucket}.s3.${this.region}.amazonaws.com/${key}`;
  }
}
