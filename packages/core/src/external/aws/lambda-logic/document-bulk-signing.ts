import { S3Utils } from "../s3";

const SIGNED_URL_DURATION_SECONDS = 3600; // longer since a lot of docs
export const DocumentDownloadStatus = ["processing", "completed", "failed"] as const;
export type DocumentDownloadStatus = (typeof DocumentDownloadStatus)[number];

export type Progress = {
  status: DocumentDownloadStatus;
  total?: number;
  successful?: number;
  errors?: number;
};

export type DocumentBulkDownloadProgress = {
  download?: Progress;
};

export async function getSignedUrls(
  fileNames: string[],
  bucketName: string,
  region: string
): Promise<string[]> {
  const s3Utils = new S3Utils(region);
  if (!Array.isArray(fileNames)) {
    throw new Error("fileNames must be an array");
  }

  return await Promise.all(
    fileNames.map(async fileName => {
      return await s3Utils.s3.getSignedUrl("getObject", {
        Bucket: bucketName,
        Key: fileName,
        Expires: SIGNED_URL_DURATION_SECONDS,
      });
    })
  );
}
