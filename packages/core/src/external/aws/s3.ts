import * as AWS from "aws-sdk";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";

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
  if (fileKey.includes("_")) {
    const keyParts = fileKey.split("_");
    if (keyParts[0] && keyParts[1] && keyParts[2] && keyParts[0].includes("/")) {
      const cxIdParts = keyParts[0].split("/");
      if (cxIdParts[0]) {
        const cxId = cxIdParts[0];
        const patientId = keyParts[1];
        const docId = keyParts[2];
        const fileData = {
          cxId,
          patientId,
          docId,
        };
        return fileData;
      }
    }
  }
  return;
};

export async function getSignedUrl({
  bucketName,
  fileName,
  durationSeconds,
  awsRegion,
}: {
  bucketName: string;
  fileName: string;
  durationSeconds?: number;
  awsRegion: string;
}): Promise<string> {
  return makeS3Client(awsRegion).getSignedUrlPromise("getObject", {
    Bucket: bucketName,
    Key: fileName,
    Expires: durationSeconds ?? DEFAULT_SIGNED_URL_DURATION,
  });
}

export async function getFileInfoFromS3({
  key,
  bucket,
  s3,
  region,
}: {
  key: string;
  bucket: string;
  s3?: AWS.S3;
  region?: string;
}): Promise<
  | { exists: true; size: number; contentType: string | undefined }
  | { exists: false; size?: never; contentType?: never }
> {
  if (!s3 && !region) {
    throw new Error("Either 's3' or 'region' must be provided.");
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const s3Client = s3 ?? makeS3Client(region!);
    const head = await s3Client
      .headObject({
        Bucket: bucket,
        Key: key,
      })
      .promise();
    return {
      exists: true,
      size: head.ContentLength ?? 0,
      contentType: head.ContentType ?? undefined,
    };
  } catch (err) {
    return { exists: false };
  }
}
