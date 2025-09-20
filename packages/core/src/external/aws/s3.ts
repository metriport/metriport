import {
  _Object,
  CommonPrefix,
  CopyObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl as getPresignedUrl } from "@aws-sdk/s3-request-presigner";
import {
  emptyFunction,
  errorToString,
  executeWithRetries,
  ExecuteWithRetriesOptions,
  MetriportError,
  NotFoundError,
} from "@metriport/shared";
import { StreamingBlobPayloadOutputTypes } from "@smithy/types";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import * as stream from "stream";
import { out } from "../../util/log";
import { capture } from "../../util/notifications";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";

dayjs.extend(duration);

const DEFAULT_SIGNED_URL_DURATION = dayjs.duration({ minutes: 3 }).asSeconds();
const defaultS3RetriesConfig = {
  maxAttempts: 5,
  initialDelay: 500,
};
const protocolRegex = /^https?:\/\//;

export type FileInfoExists = {
  exists: true;
  /** @deprecated Use `sizeInBytes` instead */
  size: number;
  sizeInBytes: number; // TODO Enable this when testing something that uses this code
  contentType: string;
  eTag?: string;
  createdAt: Date | undefined;
  metadata: Record<string, string> | undefined;
};

export type FileInfoNotExists = {
  exists: false;
  size?: never;
  sizeInBytes?: never;
  contentType?: never;
  eTag?: never;
  createdAt?: never;
  metadata?: never;
};

export type BucketAndKey = {
  bucket: string;
  key: string;
};

export type GetSignedUrlWithBucketAndKey = {
  bucketName: string;
  fileName: string;
  /**
   * Duration in seconds for which the signed URL will be valid
   */
  durationSeconds?: number;
  /**
   * The version ID of the object the presigned URL is for, if applicable
   */
  versionId?: string;
};

export type GetSignedUrlWithLocation = {
  /**
   * The S3 location string (typically in format s3://bucket-name/file-name)
   */
  location: string;
  /**
   * Duration in seconds for which the signed URL will be valid
   */
  durationSeconds?: number;
  /**
   * The version ID of the object the presigned URL is for, if applicable
   */
  versionId?: string;
};

export type UploadFileResult = {
  location: string;
  eTag: string;
  bucket: string;
  key: string;
  versionId: string | undefined;
};

export type UploadParams = {
  bucket: string;
  key: string;
  file: Buffer;
  contentType?: string;
  contentEncoding?: string;
  metadata?: Record<string, string>;
};

export type StoreInS3Params = {
  s3Utils: S3Utils;
  payload: string;
  bucketName: string;
  fileName: string;
  contentType: string;
  log: typeof console.log;
  errorConfig?: {
    errorMessage: string;
    context: string;
    captureParams?: Record<string, unknown>;
    shouldCapture: boolean;
  };
};

export type GetFileContentsIntoStreamParams = {
  bucket: string;
  key: string;
  writeStream: stream.Writable;
};

export async function executeWithRetriesS3<T>(
  fn: () => Promise<T>,
  options?: ExecuteWithRetriesOptions<T>
): Promise<T> {
  const log = options?.log ?? out("executeWithRetriesS3").log;
  return await executeWithRetries(fn, {
    ...defaultS3RetriesConfig,
    ...options,
    log,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    shouldRetry: (_, error: any) => {
      if (!error) return false;
      if (isNotFoundError(error)) return false;
      if (!isRetriableError(error)) return false;
      return true;
    },
  });
}

type FileExistsFilter = {
  path: string;
  targetString: string;
};

export class S3Utils {
  private readonly _s3Client: S3Client;

  constructor(readonly region: string) {
    this._s3Client = new S3Client({ region });
  }

  get s3Client(): S3Client {
    return this._s3Client;
  }

  async getFileContentsIntoStream({
    bucket,
    key,
    writeStream,
  }: GetFileContentsIntoStreamParams): Promise<void> {
    const readStream = await this.getReadStream({ bucket, key });
    if (!(readStream instanceof Readable)) {
      throw new Error(`Invalid read stream for ${key}`);
    }
    return await pipeline(readStream, writeStream);
  }

  async getFileContentsAsString(
    s3BucketName: string,
    s3FileName: string,
    encoding?: BufferEncoding
  ): Promise<string> {
    return hydrateErrors(
      async () => {
        const stream = await this.getReadStream({ bucket: s3BucketName, key: s3FileName });
        return await stream.transformToString(encoding);
      },
      {
        bucket: s3BucketName,
        key: s3FileName,
      },
      `getFileContentsAsString`
    );
  }

  async getFileContentsAsBuffer({ bucket, key }: BucketAndKey): Promise<Buffer> {
    return hydrateErrors(
      async () => {
        const stream = await this.getReadStream({ bucket, key });
        return Buffer.from(await stream.transformToByteArray());
      },
      {
        bucket,
        key,
      },
      `getFileContentsAsBuffer`
    );
  }

  async getReadStream({ bucket, key }: BucketAndKey): Promise<StreamingBlobPayloadOutputTypes> {
    const resp = await executeWithRetriesS3(() =>
      this.s3Client.send(new GetObjectCommand({ Bucket: bucket, Key: key }))
    );
    if (!resp.Body) throw new Error(`No body found for ${key}`);
    return resp.Body;
  }

  async getFileInfoFromS3(
    key: string,
    bucket: string
  ): Promise<FileInfoExists | FileInfoNotExists> {
    try {
      const head = await executeWithRetriesS3(
        () =>
          this._s3Client.send(
            new HeadObjectCommand({
              Bucket: bucket,
              Key: key,
            })
          ),
        {
          log: emptyFunction,
        }
      );
      const sizeInBytes = head.ContentLength ?? 0;
      return {
        exists: true,
        size: sizeInBytes,
        sizeInBytes,
        contentType: head.ContentType ?? "",
        eTag: head.ETag ?? "",
        createdAt: head.LastModified,
        metadata: head.Metadata,
      };
    } catch (err) {
      if (isNotFoundError(err)) return { exists: false };
      throw new MetriportError("Error on getFileInfoFromS3", err, { bucket, key });
    }
  }

  async fileExists(bucket: string, key: string): Promise<boolean>;
  async fileExists(bucket: string, filters: FileExistsFilter): Promise<boolean>;
  async fileExists(bucket: string, keyOrFilters: string | FileExistsFilter): Promise<boolean> {
    if (typeof keyOrFilters === "string") {
      const fileInfo = await this.getFileInfoFromS3(keyOrFilters, bucket);
      return fileInfo.exists;
    }
    return this.filesWithPathExist({
      bucket,
      ...keyOrFilters,
    });
  }

  private async filesWithPathExist({
    bucket,
    path,
    targetString,
  }: {
    bucket: string;
    path: string;
    targetString?: string | undefined;
  }): Promise<boolean> {
    const data = await executeWithRetriesS3(() =>
      this._s3Client.send(
        new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: path,
        })
      )
    );
    const bucketContents = data.Contents;
    if (!bucketContents) return false;

    for (const file of bucketContents) {
      if (targetString && file.Key?.includes(targetString)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Returns a presigned URL for a file in an S3 bucket.
   *
   * @param params - Parameters for generating a signed URL
   * @param params.bucketName - The name of the S3 bucket (when using bucket+key format)
   * @param params.fileName - The key/filename of the object (when using bucket+key format)
   * @param params.location - Full S3 location in the format 's3://bucket-name/key' (alternative to providing bucketName+fileName)
   * @param params.versionId - Optional version ID of the object
   * @param params.durationSeconds - Optional duration in seconds for URL validity
   * @returns Promise<string> - The presigned URL for the file
   */
  async getSignedUrl(params: GetSignedUrlWithBucketAndKey): Promise<string>;
  async getSignedUrl(params: GetSignedUrlWithLocation): Promise<string>;
  async getSignedUrl(
    params: GetSignedUrlWithBucketAndKey | GetSignedUrlWithLocation
  ): Promise<string> {
    if ("location" in params) {
      const tmp = splitS3Location(params.location);
      if (!tmp) throw new Error("Could not parse S3 location");
      const { bucketName, key } = tmp;
      return this.getSignedUrlInternal({
        bucketName,
        fileName: key,
        ...(params.versionId ? { versionId: params.versionId } : {}),
        ...(params.durationSeconds ? { durationSeconds: params.durationSeconds } : undefined),
      });
    } else {
      return this.getSignedUrlInternal(params);
    }
  }

  private async getSignedUrlInternal({
    bucketName,
    fileName,
    durationSeconds,
    versionId,
  }: {
    bucketName: string;
    fileName: string;
    durationSeconds?: number;
    versionId?: string;
  }): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: fileName,
      ...(versionId ? { VersionId: versionId } : {}),
    });
    return executeWithRetriesS3(() =>
      getPresignedUrl(this.s3Client, command, {
        expiresIn: durationSeconds ?? DEFAULT_SIGNED_URL_DURATION,
      })
    );
  }

  /**
   * Returns a presigned URL for uploading a file to an S3 bucket.
   *
   * @param bucket - The name of the S3 bucket where the file will located.
   * @param key - The key or path of the file to be created in the S3 bucket.
   * @param durationSeconds - The duration in seconds for which the presigned URL will be valid.
   * @param metadata - The metadata to be added to the file in the S3 bucket (it will be sent as
   *                   part of the upload request URL's parameters). It can be retrieved after
   *                   the file is uplaoded by issuing a HEAD request to S3 (getFileInfoFromS3()).
   * @returns The presigned URL for the file.
   */
  async getPresignedUploadUrl({
    bucket,
    key,
    durationSeconds,
    metadata = {},
  }: {
    bucket: string;
    key: string;
    durationSeconds?: number;
    metadata?: Record<string, string>;
  }): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Metadata: metadata,
    });
    const presignedUrl = await executeWithRetriesS3(() =>
      getPresignedUrl(this.s3Client, command, {
        expiresIn: durationSeconds ?? DEFAULT_SIGNED_URL_DURATION,
      })
    );
    return presignedUrl;
  }

  buildFileUrl(bucket: string, key: string): string {
    return `https://${bucket}.s3.${this.region}.amazonaws.com/${key}`;
  }

  /**
   * Updates the content type and extension of a file in an S3 bucket by copying the file with the new metadata and deleting the original file.
   *
   * @param bucket - The name of the S3 bucket where the file is located.
   * @param key - The key or path of the file in the S3 bucket.
   * @param newContentType - The new content type to be set for the file.
   * @param newExtension - The new extension to be added to the file name.
   * @returns The new key or path of the file in the S3 bucket after updating the content type and extension.
   */
  async updateContentTypeInS3(
    bucket: string,
    key: string,
    newContentType: string,
    newExtension: string
  ): Promise<string> {
    const copySource = encodeURIComponent(`${bucket}/${key}`);
    // Extract the file name without the old extension
    const lastDotIndex = key.lastIndexOf(".");
    const fileNameWithoutExtension = key.substring(0, lastDotIndex);

    // Append the new extension to the file name
    const newKey = `${fileNameWithoutExtension}.${newExtension.replace(/^\.+/, "")}`;

    // If the new key is the same as the old key, dont replace or delete any file and return the original key
    if (newKey === key) {
      return newKey;
    }
    // If the new key is different from the old key, copy the file with the new metadata and delete the original file

    // TODO move to `copyFile()`
    const copyObjectCommand = new CopyObjectCommand({
      Bucket: bucket,
      Key: newKey,
      CopySource: copySource,
      ContentType: newContentType,
      MetadataDirective: "REPLACE",
    });
    await executeWithRetriesS3(() => this.s3Client.send(copyObjectCommand));

    try {
      const deleteObjectCommand = new DeleteObjectCommand({
        Bucket: bucket,
        Key: key,
      });
      await executeWithRetriesS3(() => this.s3Client.send(deleteObjectCommand));
    } catch (error) {
      const msg = "Failed to delete the original file from S3";
      const { log } = out("updateContentTypeInS3");
      log(`${msg}: ${errorToString(error)}`);
      capture.error(msg, {
        extra: {
          bucket,
          key,
          context: `updateContentTypeInS3.delete`,
          error,
        },
      });
    }
    return newKey;
  }

  async copyFile({
    fromBucket,
    fromKey,
    toBucket,
    toKey,
  }: {
    fromBucket: string;
    fromKey: string;
    toBucket: string;
    toKey: string;
  }): Promise<void> {
    const copySource = encodeURIComponent(`${fromBucket}/${fromKey}`);
    const copyObjectCommand = new CopyObjectCommand({
      Bucket: toBucket,
      Key: toKey,
      CopySource: copySource,
    });
    await executeWithRetriesS3(() => this.s3Client.send(copyObjectCommand));
  }

  async uploadFile({
    bucket,
    key,
    file,
    contentType,
    contentEncoding,
    metadata,
  }: UploadParams): Promise<UploadFileResult> {
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: file,
      ...(contentType ? { ContentType: contentType } : undefined),
      ...(contentEncoding ? { ContentEncoding: contentEncoding } : undefined),
      ...(metadata ? { Metadata: metadata } : undefined),
    });
    try {
      const resp = await executeWithRetriesS3(() => this.s3Client.send(command));

      return {
        location: this.getLocation({ key, bucket }),
        eTag: resp.ETag ?? "",
        bucket: bucket,
        key: key,
        versionId: resp.VersionId,
      };
    } catch (error) {
      const { log } = out("uploadFile");
      log(`Error during upload: ${errorToString(error)}`);
      throw error;
    }
  }

  getLocation({ key, bucket }: BucketAndKey): string {
    return `https://${bucket}.s3.${this.region}.amazonaws.com/${key}`;
  }

  /** @deprecated Use getFileContentsAsBuffer instead */
  async downloadFile({ bucket, key }: BucketAndKey): Promise<Buffer> {
    try {
      return await this.getFileContentsAsBuffer({ bucket, key });
    } catch (error) {
      const { log } = out("downloadFile");
      log(`Error during download: ${errorToString(error)}`);
      throw error;
    }
  }

  async deleteFile({ bucket, key }: BucketAndKey): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    });
    try {
      await executeWithRetriesS3(() => this.s3Client.send(command));
    } catch (error) {
      const { log } = out("deleteFile");
      log(`Error during file deletion: ${errorToString(error)}`);
      throw error;
    }
  }

  async deleteFiles({ bucket, keys }: { bucket: string; keys: string[] }): Promise<void> {
    const command = new DeleteObjectsCommand({
      Bucket: bucket,
      Delete: {
        Objects: keys.map(key => ({ Key: key })),
      },
    });
    try {
      await executeWithRetriesS3(() => this.s3Client.send(command));
    } catch (error) {
      const { log } = out("deleteFiles");
      log(`Error during files deletion: ${errorToString(error)}`);
      throw error;
    }
  }

  async listObjects(
    bucket: string,
    prefix: string,
    options: { maxAttempts?: number } = {}
  ): Promise<_Object[]> {
    const allObjects: _Object[] = [];
    let continuationToken: string | undefined;
    do {
      const command = new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ...(continuationToken ? { ContinuationToken: continuationToken } : {}),
      });
      const res = await executeWithRetriesS3(() => this.s3Client.send(command), options);
      if (res.Contents) {
        allObjects.push(...res.Contents);
      }
      continuationToken = res.NextContinuationToken;
    } while (continuationToken);
    return allObjects;
  }

  /**
   * Lists the first level "subdirectories" from an S3 prefix.
   * Example:
   * - S3 contents:
   *   - "one/two/threeA/..."
   *   - "one/two/threeB/..."
   *   - "one/two/threeC/..."
   * - Prefix: "one/two/"
   * - Returns: ["one/two/threeA/", "one/two/threeB/", "one/two/threeC/"]
   *
   * @param bucket - The name of the S3 bucket to list the first level "subdirectories" from.
   * @param prefix - The prefix to list the first level "subdirectories" from.
   * @param delimiter - The delimiter to use to list the first level "subdirectories" from.
   * @returns The first level "subdirectories" from the S3 prefix (full S3 paths).
   */
  async listFirstLevelSubdirectories({
    bucket,
    prefix,
    delimiter = "/",
  }: {
    bucket: string;
    prefix: string;
    delimiter?: string | undefined;
  }): Promise<CommonPrefix[]> {
    const allObjects: CommonPrefix[] = [];
    let continuationToken: string | undefined;
    do {
      const res = await executeWithRetriesS3(() =>
        this._s3Client.send(
          new ListObjectsV2Command({
            Bucket: bucket,
            Prefix: prefix,
            ...(delimiter ? { Delimiter: delimiter } : {}),
            ...(continuationToken ? { ContinuationToken: continuationToken } : {}),
          })
        )
      );
      if (res.CommonPrefixes) {
        allObjects.push(...res.CommonPrefixes);
      }
      continuationToken = res.NextContinuationToken;
    } while (continuationToken);
    return allObjects;
  }
}

export function splitS3Location(location: string): { bucketName: string; key: string } | undefined {
  // convert S3 location to bucket and key based on this format: "https://metriport-medical-documents.s3.us-west-1.amazonaws.com/6faef82d-dae0-48b7-9929-8dc5aeb984a6/01900d1a-7323-732b-90b2-936f3835bf74/6faef82d-dae0-48b7-9929-8dc5aeb984a6_01900d1a-7323-732b-90b2-936f3835bf74_MR.html"
  if (!location.match(protocolRegex)) return undefined;
  const [domain, ...path] = location.replace(protocolRegex, "").split("/");
  if (!domain) return undefined;
  if (!path || path.length < 1) return undefined;
  const bucketName = domain.split(".")[0];
  if (!bucketName) return undefined;
  const key = path.join("/");
  return { bucketName, key };
}

export async function returnUndefinedOn404<T>(fn: () => Promise<T>): Promise<T | undefined> {
  try {
    return await fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    if (isNotFoundError(error)) return undefined;
    throw error;
  }
}

export async function hydrateErrors<T>(
  fn: () => Promise<T>,
  fileInfo: BucketAndKey,
  functionName: string
): Promise<T> {
  try {
    return await fn();
    //eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (error: any) {
    if (isNotFoundError(error)) {
      throw new NotFoundError("Key not found", error, fileInfo);
    }
    throw new MetriportError(`Error on ${functionName}`, error, fileInfo);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isNotFoundError(error: any): boolean {
  return (
    error.Code === "NoSuchKey" ||
    error.code === "NoSuchKey" ||
    error.statusCode === 404 || // v2
    error?.$metadata?.httpStatusCode === 404 || // v3
    error.name === "NotFound" || // v3 common name
    error instanceof NotFoundError
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isRetriableError(error: any): boolean {
  const errorsToRetry = ["EPIPE", "ECONNRESET"];
  if (
    (typeof error.code === "string" && errorsToRetry.includes(error.code)) ||
    (typeof error.message === "string" && errorsToRetry.some(code => error.message.includes(code)))
  ) {
    return true;
  }
  return error.retryable === true || error.Retryable === true;
}

export async function storeInS3WithRetries({
  s3Utils,
  payload,
  bucketName,
  fileName,
  contentType,
  log,
  errorConfig,
}: StoreInS3Params): Promise<void> {
  try {
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: fileName,
      Body: payload,
      ContentType: contentType,
    });
    await executeWithRetriesS3(() => s3Utils.s3Client.send(command), {
      ...defaultS3RetriesConfig,
      log,
    });
  } catch (error) {
    const msg = errorConfig?.errorMessage ?? "Error uploading to S3";
    log(`${msg}: ${errorToString(error)}`);

    if (errorConfig?.shouldCapture) {
      capture.error(msg, {
        extra: {
          fileName,
          context: errorConfig.context,
          error,
          errorMessage: errorConfig.errorMessage,
          ...errorConfig.captureParams,
        },
      });
    }
    throw error;
  }
}
