import { S3Utils } from "../../../external/aws/s3";

export interface DocumentRetrievalParams {
  fileName: string;
  s3Utils: S3Utils;
  bucketName: string;
}

export async function retrieveDocumentForCommonWellContribution(
  params: DocumentRetrievalParams
): Promise<string> {
  const { fileName, s3Utils, bucketName } = params;

  if (fileName.trim().length <= 0) {
    throw new Error("Missing fileName parameter");
  }

  const key = fileName.startsWith("/") ? fileName.slice(1) : fileName;
  if (!key || key.trim().length <= 0) {
    throw new Error("Invalid fileName parameter");
  }

  const docString = await s3Utils.getFileContentsAsString(bucketName, key);
  return docString;
}
