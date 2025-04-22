import { BadRequestError, errorToString, MetriportError, NotFoundError } from "@metriport/shared";
import { BundleWithLastModified } from "@metriport/shared/interface/external/ehr/fhir-resource";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { Config } from "../../../../util/config";
import { log, out } from "../../../../util/log";
import { BundleKeyBaseParams, createKeyMap, getS3UtilsInstance } from "../bundle-shared";

dayjs.extend(duration);

export type FetchBundleParams = BundleKeyBaseParams & {
  fetchLastModified?: boolean;
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
 * @param jobId - The job ID of the bundle. If not provided, the latest bundle will be used.
 * @param fetchLastModified - Whether to fetch the last modified date. (optional, defaults to false)
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
  fetchLastModified = false,
  s3BucketName = Config.getEhrBundleBucketName(),
}: FetchBundleParams): Promise<BundleWithLastModified | undefined> {
  const { log } = out(
    `EhrResourceDiff fetchBundle - ehr ${ehr} cxId ${cxId} metriportPatientId ${metriportPatientId} ehrPatientId ${ehrPatientId} bundleType ${bundleType} resourceType ${resourceType}  `
  );
  const s3Utils = getS3UtilsInstance();
  const createKey = createKeyMap[bundleType];
  if (!createKey) throw new BadRequestError("Invalid bundle type", undefined, { bundleType });
  const key = createKey({ ehr, cxId, metriportPatientId, ehrPatientId, resourceType, jobId });
  try {
    const fileExists = await s3Utils.fileExists(s3BucketName, key);
    if (!fileExists) return undefined;
    const [file, fileInfo] = await Promise.all([
      s3Utils.getFileContentsAsString(s3BucketName, key),
      fetchLastModified ? s3Utils.getFileInfoFromS3(s3BucketName, key) : undefined,
    ]);
    return {
      bundle: JSON.parse(file),
      lastModified: fileInfo?.createdAt,
    };
  } catch (error) {
    const msg = "Failure while fetching bundle @ Ehr";
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
      context: "ehr-resource-diff.fetchBundle",
    });
  }
}

/**
 * Fetches a bundle from S3 for the given bundle type and resource type
 * If the bundle is not found, it throws a NotFoundError.
 *
 * @param ehr - The EHR source.
 * @param cxId - The CX ID.
 * @param metriportPatientId - The Metriport ID.
 * @param ehrPatientId - The EHR patient ID.
 * @param bundleType - The bundle type.
 * @param resourceType - The resource type of the bundle.
 * @param jobId - The job ID of the bundle. If not provided, the latest bundle will be used.
 * @param fetchLastModified - Whether to fetch the last modified date. (optional, defaults to false)
 * @param s3BucketName - The S3 bucket name (optional, defaults to the EHR bundle bucket)
 * @returns The bundle with the last modified date.
 * @throws NotFoundError if the bundle is not found.
 */
export async function fetchBundleOrFail({
  ehr,
  cxId,
  metriportPatientId,
  ehrPatientId,
  bundleType,
  resourceType,
  jobId,
  fetchLastModified = false,
  s3BucketName = Config.getEhrBundleBucketName(),
}: FetchBundleParams): Promise<BundleWithLastModified> {
  const bundle = await fetchBundle({
    ehr,
    cxId,
    metriportPatientId,
    ehrPatientId,
    bundleType,
    resourceType,
    jobId,
    fetchLastModified,
    s3BucketName,
  });
  if (!bundle) {
    throw new NotFoundError("Bundle not found @ Ehr", {
      ehr,
      cxId,
      metriportPatientId,
      ehrPatientId,
      bundleType,
      resourceType,
      jobId,
      s3BucketName,
      context: "ehr-resource-diff.fetchBundleOrFail",
    });
  }
  return bundle;
}

/**
 * Fetches a pre-signed URL for a bundle from S3 for the given bundle type and resource type
 * If the bundle is not found, it returns undefined.
 *
 * @param ehr - The EHR source.
 * @param cxId - The CX ID.
 * @param metriportPatientId - The Metriport ID.
 * @param ehrPatientId - The EHR patient ID.
 * @param bundleType - The bundle type.
 * @param resourceType - The resource type of the bundle.
 * @param jobId - The job ID of the bundle. If not provided, the latest bundle will be used.
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
  s3BucketName = Config.getEhrBundleBucketName(),
}: Omit<FetchBundleParams, "fetchLastModified">): Promise<string | undefined> {
  const s3Utils = getS3UtilsInstance();
  const createKey = createKeyMap[bundleType];
  if (!createKey) throw new BadRequestError("Invalid bundle type", undefined, { bundleType });
  const key = createKey({ ehr, cxId, metriportPatientId, ehrPatientId, resourceType, jobId });
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
      context: "ehr-resource-diff.fetchBundlePreSignedUrl",
    });
  }
}
