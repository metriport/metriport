import { BadRequestError } from "@metriport/shared";
import { S3Utils } from "../../../external/aws/s3";
import { getFilePathFromDocumentId } from "../../../shareback/file";
import { docContributionFileParam } from "../../commonwell-v1/document/document-contribution";

export interface DocumentRetrievalParams {
  documentIdOrFileNameOrFilePath: string;
  s3Utils: S3Utils;
  bucketName: string;
}

export async function retrieveDocumentForCommonWellContribution(
  params: DocumentRetrievalParams
): Promise<string> {
  const { documentIdOrFileNameOrFilePath, s3Utils, bucketName } = params;

  const withoutLeadingSlash = documentIdOrFileNameOrFilePath.startsWith("/")
    ? documentIdOrFileNameOrFilePath.slice(1)
    : documentIdOrFileNameOrFilePath;
  if (!withoutLeadingSlash || withoutLeadingSlash.trim().length < 1) {
    throw new BadRequestError(`Invalid ${docContributionFileParam} parameter`, undefined, {
      documentIdOrFileNameOrFilePath,
    });
  }

  const fileS3Key = await getFilePathFromDocumentId(withoutLeadingSlash);

  const docString = await s3Utils.getFileContentsAsString(bucketName, fileS3Key);
  return docString;
}
