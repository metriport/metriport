import {
  BadRequestError,
  errorToString,
  executeWithNetworkRetries,
  MetriportError,
} from "@metriport/shared";
import { BundleWithLastModified } from "@metriport/shared/interface/external/ehr/fhir-resource";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { Config } from "../../../../util/config";
import { out } from "../../../../util/log";
import {
  BundleKeyBaseParams,
  createKeyMap,
  getS3UtilsInstance,
  isResourceDiffBundleType,
} from "../bundle-shared";

dayjs.extend(duration);

export type FetchBundleParams = BundleKeyBaseParams & {
  getLastModified?: boolean;
};

const bundleUrlDuration = dayjs.duration(1, "hour");

/**
 * Fetches a bundle from S3 for the given bundle type and resource type.
 *
 * @param ehr - The EHR source.
 * @param cxId - The CX ID.
 * @param metriportPatientId - The Metriport ID.
 * @param ehrPatientId - The EHR patient ID.
 * @param bundleType - The bundle type.
 * @param resourceType - The resource type of the bundle.
 * @param jobId - The job ID of the bundle. If not provided, the tag 'latest' will be used.
 * @param resourceId - The resource ID of the bundle.
 * @param getLastModified - Whether to fetch the last modified date. (optional, defaults to false)
 * @param s3BucketName - The S3 bucket name (optional, defaults to the EHR bundle bucket)
 * @returns The bundle with the last modified date or undefined if the bundle is not found.
 */
export async function fetchBundle({
  ehr,
  cxId,
  metriportPatientId,
  ehrPatientId,
  bundleType,
  resourceType,
  jobId,
  resourceId,
  getLastModified = false,
  s3BucketName = Config.getEhrBundleBucketName(),
}: FetchBundleParams): Promise<BundleWithLastModified | undefined> {
  const { log } = out(`Ehr fetchBundle - ehr ${ehr} cxId ${cxId} ehrPatientId ${ehrPatientId}`);
  if (isResourceDiffBundleType(bundleType) && !jobId) {
    throw new BadRequestError(
      "Job ID must be provided when fetching resource diff bundles",
      undefined,
      { metriportPatientId, ehrPatientId, bundleType, jobId }
    );
  }
  const s3Utils = getS3UtilsInstance();
  const createKey = createKeyMap[bundleType];
  if (!createKey) throw new BadRequestError("Invalid bundle type", undefined, { bundleType });
  const key = createKey({
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
      bundle: JSON.parse(file),
      lastModified: fileInfo?.createdAt,
    };
  } catch (error) {
    const msg = "Failure while fetching bundle @ S3";
    log(`${msg}. Cause: ${errorToString(error)}`);
    throw new MetriportError(msg, error, {
      ehr,
      cxId,
      metriportPatientId,
      ehrPatientId,
      bundleType,
      resourceType,
      jobId,
      key,
      context: "ehr.fetchBundle",
    });
  }
}

export type FetchBundlePreSignedUrlParams = Omit<FetchBundleParams, "getLastModified">;

/**
 * Fetches a pre-signed URL for a bundle from S3 for the given bundle type and resource type.
 * If the bundle is not found, it returns undefined.
 *
 * @param ehr - The EHR source.
 * @param cxId - The CX ID.
 * @param metriportPatientId - The Metriport ID.
 * @param ehrPatientId - The EHR patient ID.
 * @param bundleType - The bundle type.
 * @param resourceType - The resource type of the bundle.
 * @param jobId - The job ID of the bundle. If not provided, the tag 'latest' will be used.
 * @param resourceId - The resource ID of the bundle.
 * @param s3BucketName - The S3 bucket name (optional, defaults to the EHR bundle bucket)
 * @returns The pre-signed URL of the bundle if found, otherwise undefined. Valid for 1 hour.
 */
export async function fetchBundlePreSignedUrl({
  ehr,
  cxId,
  metriportPatientId,
  ehrPatientId,
  bundleType,
  resourceType,
  jobId,
  resourceId,
  s3BucketName = Config.getEhrBundleBucketName(),
}: FetchBundlePreSignedUrlParams): Promise<string | undefined> {
  const { log } = out(
    `Ehr fetchBundlePreSignedUrl - ehr ${ehr} cxId ${cxId} ehrPatientId ${ehrPatientId}`
  );
  if (isResourceDiffBundleType(bundleType) && !jobId) {
    throw new BadRequestError(
      "Job ID must be provided when fetching resource diff bundles",
      undefined,
      { metriportPatientId, ehrPatientId, bundleType, jobId }
    );
  }
  const s3Utils = getS3UtilsInstance();
  const createKey = createKeyMap[bundleType];
  if (!createKey) throw new BadRequestError("Invalid bundle type", undefined, { bundleType });
  const key = createKey({
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
      durationSeconds: bundleUrlDuration.asSeconds(),
    });
  } catch (error) {
    const msg = "Failure while fetching bundle pre-signed URL @ Ehr";
    log(`${msg}. Cause: ${errorToString(error)}`);
    throw new MetriportError(msg, error, {
      ehr,
      cxId,
      metriportPatientId,
      ehrPatientId,
      bundleType,
      resourceType,
      jobId,
      s3BucketName,
      context: "ehr.fetchBundlePreSignedUrl",
    });
  }
}
