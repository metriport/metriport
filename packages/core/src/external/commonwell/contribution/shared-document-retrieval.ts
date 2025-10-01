import { parseFilePath } from "../../../domain/filename";
import { S3Utils } from "../../../external/aws/s3";

export interface DocumentRetrievalParams {
  fileName: string;
  s3Utils: S3Utils;
  bucketName: string;
}

export async function retrieveDocumentForCommonWell(
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

  const parsedFileName = parseFilePath(key);
  if (!parsedFileName) {
    throw new Error("Invalid fileName parameter - unable to parse");
  }

  const docString = await s3Utils.getFileContentsAsString(bucketName, key);
  return docString;
}
