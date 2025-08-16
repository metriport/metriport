import {
  BadRequestError,
  errorToString,
  executeWithNetworkRetries,
  MetriportError,
} from "@metriport/shared";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { Config } from "../../../../util/config";
import { out } from "../../../../util/log";
import {
  createKeyAndExtensionMap,
  DocumentKeyBaseParams,
  getS3UtilsInstance,
} from "../document-shared";

dayjs.extend(duration);

export type FetchDocumentParams = DocumentKeyBaseParams & {
  getLastModified?: boolean;
};

const documentUrlDuration = dayjs.duration(1, "hour");

/**
 * Fetches a document from S3 for the given document type and resource type.
 *
 * @param ehr - The EHR source.
 * @param cxId - The CX ID.
 * @param metriportPatientId - The Metriport ID.
 * @param ehrPatientId - The EHR patient ID.
 * @param documentType - The document type.
 * @param resourceType - The resource type of the document.
 * @param jobId - The job ID of the document. If not provided, the tag 'latest' will be used.
 * @param resourceId - The resource ID of the document.
 * @param getLastModified - Whether to fetch the last modified date. (optional, defaults to false)
 * @param s3BucketName - The S3 bucket name (optional, defaults to the EHR bundle bucket)
 * @returns The document with the last modified date or undefined if the document is not found.
 */
export async function fetchDocument({
  ehr,
  cxId,
  metriportPatientId,
  ehrPatientId,
  documentType,
  resourceType,
  jobId,
  resourceId,
  getLastModified = false,
  s3BucketName = Config.getEhrBundleBucketName(),
}: FetchDocumentParams): Promise<{ file: string; lastModified: Date | undefined } | undefined> {
  const { log } = out(`Ehr fetchDocument - ehr ${ehr} cxId ${cxId} ehrPatientId ${ehrPatientId}`);
  const s3Utils = getS3UtilsInstance();
  const createKeyAndExtension = createKeyAndExtensionMap[documentType];
  if (!createKeyAndExtension) {
    throw new BadRequestError("Invalid document type", undefined, { documentType });
  }
  const key = createKeyAndExtension.key({
    ehr,
    cxId,
    metriportPatientId,
    ehrPatientId,
    resourceType,
    jobId,
    resourceId,
  });
  try {
    const fileExists = await s3Utils.fileExists(s3BucketName, key);
    if (!fileExists) return undefined;
    const [file, fileInfo] = await executeWithNetworkRetries(async () => {
      return Promise.all([
        s3Utils.getFileContentsAsString(s3BucketName, key),
        getLastModified ? s3Utils.getFileInfoFromS3(key, s3BucketName) : undefined,
      ]);
    });
    return {
      file: file,
      lastModified: fileInfo?.createdAt,
    };
  } catch (error) {
    const msg = "Failure while fetching document @ S3";
    log(`${msg}. Cause: ${errorToString(error)}`);
    throw new MetriportError(msg, error, {
      ehr,
      cxId,
      metriportPatientId,
      ehrPatientId,
      documentType,
      resourceType,
      jobId,
      key,
      s3BucketName,
      extension: createKeyAndExtension.extension,
      context: "ehr.fetchDocument",
    });
  }
}

export type FetchDocumentPreSignedUrlParams = Omit<FetchDocumentParams, "getLastModified">;

/**
 * Fetches a pre-signed URL for a document from S3 for the given document type and resource type.
 * If the document is not found, it returns undefined.
 *
 * @param ehr - The EHR source.
 * @param cxId - The CX ID.
 * @param metriportPatientId - The Metriport ID.
 * @param ehrPatientId - The EHR patient ID.
 * @param documentType - The document type.
 * @param resourceType - The resource type of the document.
 * @param jobId - The job ID of the document. If not provided, the tag 'latest' will be used.
 * @param resourceId - The resource ID of the document.
 * @param s3BucketName - The S3 bucket name (optional, defaults to the EHR bundle bucket)
 * @returns The pre-signed URL of the document if found, otherwise undefined. Valid for 1 hour.
 */
export async function fetchDocumentPreSignedUrl({
  ehr,
  cxId,
  metriportPatientId,
  ehrPatientId,
  documentType,
  resourceType,
  jobId,
  resourceId,
  s3BucketName = Config.getEhrBundleBucketName(),
}: FetchDocumentPreSignedUrlParams): Promise<string | undefined> {
  const { log } = out(
    `Ehr fetchDocumentPreSignedUrl - ehr ${ehr} cxId ${cxId} ehrPatientId ${ehrPatientId}`
  );
  const s3Utils = getS3UtilsInstance();
  const createKeyAndExtension = createKeyAndExtensionMap[documentType];
  if (!createKeyAndExtension) {
    throw new BadRequestError("Invalid document type", undefined, { documentType });
  }
  const key = createKeyAndExtension.key({
    ehr,
    cxId,
    metriportPatientId,
    ehrPatientId,
    resourceType,
    jobId,
    resourceId,
  });
  try {
    const fileExists = await s3Utils.fileExists(s3BucketName, key);
    if (!fileExists) return undefined;
    return s3Utils.getSignedUrl({
      bucketName: s3BucketName,
      fileName: key,
      durationSeconds: documentUrlDuration.asSeconds(),
    });
  } catch (error) {
    const msg = "Failure while fetching document pre-signed URL @ S3";
    log(`${msg}. Cause: ${errorToString(error)}`);
    throw new MetriportError(msg, error, {
      ehr,
      cxId,
      metriportPatientId,
      ehrPatientId,
      documentType,
      resourceType,
      jobId,
      key,
      s3BucketName,
      extension: createKeyAndExtension.extension,
      context: "ehr.fetchDocumentPreSignedUrl",
    });
  }
}
